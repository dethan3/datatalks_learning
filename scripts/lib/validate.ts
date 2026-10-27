import type { CourseManifest, Diagnostic, DocumentNode, HtmlOutput, SourceSnapshot } from '../../src/types/course.ts';
import type { MarkdownRenderer } from 'vitepress';
import { readFile, access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createMarkdownRenderer } from 'vitepress';
import matter from 'gray-matter';
import { compileTemplate } from 'vue/compiler-sfc';
import {
  courseMarkdownPlugin, discoverCourse, hash, htmlReferences,
  parser, schemaVersion, sourceUrl, tokensIn, videoId, walkHtml
} from './course.ts';

export async function courseRenderer(docsRoot: string, manifest: CourseManifest) {
  return createMarkdownRenderer(docsRoot, {
    math: true, config: courseMarkdownPlugin(manifest)
  });
}

export function htmlIds(html: string) {
  const ids = new Set<string>();
  walkHtml(html, (node) => {
    for (const attr of node.attrs ?? []) if (attr.name === 'id' || (node.tagName === 'a' && attr.name === 'name')) ids.add(attr.value);
  });
  return ids;
}

export async function renderPages(docsRoot: string, manifest: CourseManifest, renderer: MarkdownRenderer) {
  const rendered = new Map<string, HtmlOutput>();
  for (const page of manifest.pages) {
    const relativePath = `course/${page.sourcePath}`;
    const markdown = await readFile(path.join(docsRoot, relativePath), 'utf8');
    const html = renderer.render(markdown, { relativePath, path: path.join(docsRoot, relativePath), cleanUrls: true });
    rendered.set(page.route, { html, ids: htmlIds(html), markdown });
  }
  return rendered;
}

// GitHub and VitePress can produce different anchor slugs. Keep a visible diagnostic and
// preserve the original upstream destination rather than silently shipping a broken local anchor.
export function diagnoseAnchors(manifest: CourseManifest, rendered: Map<string, HtmlOutput>) {
  for (const page of manifest.pages) for (const link of page.links) {
    if (link.kind !== 'page' || link.status !== 'local') continue;
    const url = new URL(link.url, 'https://reader.invalid');
    if (!url.hash) continue;
    let anchor;
    try { anchor = decodeURIComponent(url.hash.slice(1)); } catch { anchor = url.hash.slice(1); }
    if (!rendered.get(url.pathname)?.ids.has(anchor)) {
      manifest.diagnostics.push({
        level: 'warning', code: 'upstream-anchor-fallback', sourcePath: page.sourcePath,
        href: link.href, target: link.repoPath, anchor,
        message: `Anchor #${anchor} cannot be matched in the rendered page; link retains its official upstream destination. This does not verify that the upstream anchor exists.`
      });
      link.url = sourceUrl(link.repoPath, manifest.sourceCommit) + link.suffix;
      link.status = 'upstream-anchor-fallback';
    }
  }
}

export async function validateCourse({ docsRoot, sourceRoot, snapshot, manifest, built = false, distRoot = path.join(docsRoot, '.vitepress/dist') }: { docsRoot: string; sourceRoot: string; snapshot: SourceSnapshot; manifest: CourseManifest; built?: boolean; distRoot?: string }) {
  const findings: Diagnostic[] = [...(manifest.diagnostics ?? [])];
  const fail = (code: string, sourcePath: string, message: string) => findings.push({ level: 'error', code, sourcePath, message });
  const warn = (code: string, sourcePath: string, message: string) => findings.push({ level: 'warning', code, sourcePath, message });
  const checks = { catalog: 0, sourceIntegrity: 0, localLinks: 0, anchors: 0, images: 0, staticAssets: 0, externalLinks: 0, videos: 0, bodyVideoLinks: 0, navigation: 0, templates: 0, codeBlocks: 0, tables: 0, math: 0, builtPages: 0 };
  if (manifest.schemaVersion !== schemaVersion) fail('manifest-version', 'course-manifest.json', 'Run pnpm sync:course to update the manifest.');
  if (manifest.sourceCommit !== snapshot.commit) fail('source-revision', 'course-manifest.json', 'Manifest and independent source snapshot revisions differ.');
  const inventory = new Set(snapshot.inventory);
  let expected: Awaited<ReturnType<typeof discoverCourse>>;
  try { expected = await discoverCourse(sourceRoot, inventory, snapshot.commit); }
  catch (caught) { const error = caught instanceof Error ? caught : new Error(String(caught));
    fail('source-catalog', sourceRoot, error.message);
    return report();
  }
  const pagePaths = manifest.pages.map((page) => page.sourcePath);
  const modulePaths = manifest.modules.map((module) => module.slug);
  if (new Set(pagePaths).size !== pagePaths.length) fail('duplicate-page', 'course-manifest.json', 'Duplicate page paths.');
  if (new Set(manifest.pages.map((page) => page.route)).size !== pagePaths.length) fail('duplicate-route', 'course-manifest.json', 'Duplicate page routes.');
  if (new Set(modulePaths).size !== modulePaths.length) fail('duplicate-module', 'course-manifest.json', 'Duplicate module paths.');
  for (const module of expected.modules) {
    checks.catalog++;
    const actual = manifest.modules.find((entry) => entry.slug === module.slug);
    if (!actual) { fail('missing-module', module.slug, 'Official module directory is omitted.'); continue; }
    for (const key of ['expected', 'lessons', 'guides'] as const) {
      const expectedPaths = module[key].map((page) => page.sourcePath);
      const actualPaths = actual[key]?.map((page) => page.sourcePath) ?? [];
      if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) fail('chapter-coverage', module.slug, `${key}: missing, duplicated, unexpected or reordered chapter references.`);
    }
  }
  for (const slug of modulePaths) if (!expected.modules.some((module) => module.slug === slug)) fail('unexpected-module', slug, 'Module is not present in the official source catalog.');
  for (const file of expected.pages.keys()) if (!pagePaths.includes(file)) fail('missing-page', file, 'Expected official page is omitted.');
  for (const file of pagePaths) if (!expected.pages.has(file)) fail('unexpected-page', file, 'Page is not in the independent official catalog.');

  let missing = false;
  for (const page of manifest.pages) {
    const original = expected.pages.get(page.sourcePath);
    checks.catalog++;
    const file = path.join(docsRoot, 'course', page.sourcePath);
    let raw;
    try { raw = await readFile(file, 'utf8'); }
    catch { missing = true; fail('missing-page-file', page.sourcePath, 'Referenced page file is absent.'); continue; }
    if (!original) continue;
    checks.sourceIntegrity++;
    if (page.sourceHash !== original.sourceHash) fail('source-integrity', page.sourcePath, 'Official source hash has changed or does not match the manifest.');
    if (hash(raw) !== page.generatedHash) fail('generated-integrity', page.sourcePath, 'Generated Markdown changed after sync; resync instead of editing generated files.');
    const parsed = matter(raw);
    if (!parsed.content.startsWith(original.body)) fail('body-preservation', page.sourcePath, 'Original Markdown body was modified or truncated.');
    if (parsed.data.reader?.sourceUrl !== sourceUrl(page.sourcePath, snapshot.commit)) fail('source-attribution', page.sourcePath, 'Missing or incorrect pinned official source URL.');
    for (const key of ['video_url', 'prev_url', 'next_url'] as const) {
      if (page[key] !== original[key]) fail('metadata-preservation', page.sourcePath, `Parsed ${key} does not match official source.`);
    }
    const expectedRefs = original.links.map(({ type, href }) => `${type}:${href}`);
    const actualRefs = page.links.map(({ type, href }) => `${type}:${href}`);
    if (JSON.stringify(expectedRefs) !== JSON.stringify(actualRefs)) fail('reference-coverage', page.sourcePath, 'A source link or image was omitted or invented.');
    for (const ref of page.links) {
      const resolved = original.links.find((entry) => entry.type === ref.type && entry.href === ref.href);
      if (!resolved) continue;
      const fallback = ref.status === 'upstream-anchor-fallback' && manifest.diagnostics.some((entry) => entry.code === 'upstream-anchor-fallback' && entry.sourcePath === page.sourcePath && entry.href === ref.href) && ref.url === sourceUrl('repoPath' in ref ? ref.repoPath : '', snapshot.commit) + ref.suffix;
      if (ref.url !== resolved.url && !fallback) fail('reference-resolution', page.sourcePath, `Unexpected destination for ${ref.href}: ${ref.url}`);
      if (ref.type === 'image' && ref.status === 'upstream-missing') fail('upstream-missing-image', page.sourcePath, `Required image is absent upstream: ${ref.href}`);
      try {
        const url = new URL(ref.href);
        if (/^(www\.|m\.)?(youtube\.com|youtube-nocookie\.com|youtu\.be)$/.test(url.hostname) && (/\/(watch|embed|live|shorts)(?:\/|$)/.test(url.pathname) || url.hostname === 'youtu.be')) {
          checks.bodyVideoLinks++;
          if (!videoId(ref.href)) fail('body-video-url', page.sourcePath, `Unparseable video link in Markdown: ${ref.href}`);
        }
      } catch { /* Relative links are validated against the imported repository instead. */ }
    }
    if (page.video_url) {
      checks.videos++;
      if (!videoId(page.video_url)) fail('video-url', page.sourcePath, `Video URL is not a supported YouTube video URL: ${page.video_url}`);
    }
    for (const [direction, nav] of Object.entries(page.navigation)) {
      if (JSON.stringify(nav) !== JSON.stringify(original.navigation[direction as keyof typeof original.navigation])) fail('navigation-resolution', page.sourcePath, `${direction} differs from metadata/index resolution.`);
      if (!nav) continue;
      checks.navigation++;
      if (!manifest.pages.some((entry) => entry.sourcePath === nav.sourcePath && entry.route === nav.route)) fail('navigation-target', page.sourcePath, `${direction} target missing: ${nav.sourcePath}`);
      if (nav.sourcePath === page.sourcePath) fail('navigation-self', page.sourcePath, `${direction} points to itself.`);
    }
  }
  // Detect unwanted extra Markdown left over from a previous import, including editorial image logs.
  async function markdownFiles(dir: string, prefix = ''): Promise<string[]> {
    const result: string[] = [];
    try {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const rel = prefix + entry.name;
        if (entry.isDirectory()) result.push(...await markdownFiles(path.join(dir, entry.name), rel + '/'));
        else if (rel.endsWith('.md')) result.push(rel);
      }
    } catch { /* Missing expected directory is already reported per page. */ }
    return result;
  }
  for (const file of await markdownFiles(path.join(docsRoot, 'course'))) if (!pagePaths.includes(file)) fail('stale-generated-page', file, 'Unexpected generated Markdown remains in the course tree.');
  for (const asset of manifest.assets) {
    try {
      const buffer = await readFile(path.join(docsRoot, 'public/course-assets', asset.sourcePath));
      if (hash(buffer) !== asset.hash) fail('asset-integrity', asset.sourcePath, 'Asset hash differs from the synced official copy.');
    } catch { fail('missing-asset', asset.sourcePath, 'Referenced local asset is missing.'); }
  }
  let rendered = new Map<string, HtmlOutput>();
  if (!missing) {
    try {
      const renderer = await courseRenderer(docsRoot, manifest);
      rendered = await renderPages(docsRoot, manifest, renderer);
    } catch (caught) { const error = caught instanceof Error ? caught : new Error(String(caught)); fail('markdown-render', 'course', error.stack ?? error.message); }
  }
  for (const page of manifest.pages) {
    const output = rendered.get(page.route);
    if (!output) continue;
    const original = expected.pages.get(page.sourcePath);
    const compiled = compileTemplate({ source: output.html, filename: page.sourcePath, id: page.sourceHash });
    checks.templates++;
    for (const error of compiled.errors) fail('vue-template-compile', page.sourcePath, typeof error === 'string' ? error : error.message);
    let tableCount = 0, codeCount = 0;
    walkHtml(output.html, (node) => {
      if (node.tagName === 'table') tableCount++;
      if (node.tagName === 'pre') codeCount++;
      if (node.tagName === 'mjx-merror') fail('math-render', page.sourcePath, 'MathJax reported an invalid formula.');
    });
    let sourceTables = 0, sourceCode = 0;
    tokensIn(parser.parse(original?.body ?? '', {}), (token) => {
      if (token.type === 'table_open') sourceTables++;
      if (['fence', 'code_block'].includes(token.type)) sourceCode++;
      if (token.type === 'fence' && /^(mermaid|plantuml|math)\b/.test(token.info)) warn('unhandled-fence-format', page.sourcePath, `Fence language ${token.info} needs a dedicated renderer; currently displayed as code.`);
      if (token.type === 'text' && /\[[^\]\n]+\]\[[^\]\n]*\]/.test(token.content)) fail('unresolved-reference-format', page.sourcePath, `Unresolved reference-style Markdown: ${token.content.slice(0, 150)}`);
      if (token.type === 'html_block' && /(?:<!--\s*@include|<script\b|<style\b)/i.test(token.content)) fail('unsupported-html-format', page.sourcePath, 'Executable SFC blocks or include directives require explicit conversion.');
    });
    checks.codeBlocks += sourceCode;
    checks.tables += sourceTables;
    checks.math += (output.html.match(/<mjx-container\b/g) ?? []).length;
    if (tableCount < sourceTables) fail('table-render', page.sourcePath, 'A Markdown table did not render as a table.');
    if (codeCount < sourceCode) fail('code-render', page.sourcePath, 'A fenced or indented code block was lost.');
    // Look only at visible prose, never code blocks or MathJax internals.
    const prose: string[] = [];
    function collect(node: DocumentNode, excluded = false) {
      excluded ||= ['pre', 'code', 'mjx-container', 'script', 'style'].includes(node.tagName ?? '');
      if (!excluded && node.nodeName === '#text') prose.push(node.value ?? '');
      for (const child of node.childNodes ?? []) collect(child, excluded);
    }
    const { parseFragment } = await import('parse5');
    collect(parseFragment(output.html));
    if (prose.some((text) => /\$\$[\s\S]*?\$\$/.test(text))) fail('unrendered-math', page.sourcePath, 'Display math delimiters remain in rendered prose.');
    await checkHtml(page.route, output.html, rendered, page.sourcePath, false);
  }
  if (built) {
    const builtPages = new Map<string, HtmlOutput>();
    for (const page of manifest.pages) {
      try {
        const html = await readFile(path.join(distRoot, page.route.slice(1) + '.html'), 'utf8');
        if (page.kind === 'lesson') {
          let sourcePanel = false;
          walkHtml(html, (node) => {
            if (node.attrs?.some((attr) => attr.name === 'class' && attr.value.split(/\s+/).includes('lesson-footer-note'))) sourcePanel = true;
          });
          if (!sourcePanel || !htmlReferences(html).some((ref) => ref.type === 'link' && ref.href === page.sourceUrl)) fail('missing-built-source-attribution', page.sourcePath, 'Rendered lesson source attribution is missing.');
        }
        builtPages.set(page.route, { html, ids: htmlIds(html) });
        checks.builtPages++;
      } catch { fail('missing-built-page', page.sourcePath, 'Production HTML was not emitted.'); }
    }
    // Include the course catalog, course landing pages and other site routes as the hub grows.
    async function siteHtmlFiles(dir: string, prefix = ''): Promise<string[]> {
      const result: string[] = [];
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const relative = prefix + entry.name;
        if (entry.isDirectory() && !['assets', 'course-assets'].includes(entry.name)) result.push(...await siteHtmlFiles(path.join(dir, entry.name), relative + '/'));
        else if (entry.isFile() && relative.endsWith('.html') && relative !== '404.html') result.push(relative);
      }
      return result;
    }
    try {
      for (const file of await siteHtmlFiles(distRoot)) {
        const route = file === 'index.html' ? '/' : '/' + file.replace(/\.html$/, '');
        if (builtPages.has(route)) continue;
        const html = await readFile(path.join(distRoot, file), 'utf8');
        builtPages.set(route, { html, ids: htmlIds(html) });
      }
    } catch { fail('missing-built-site', 'index.md', 'Production site directory could not be inspected.'); }
    if (!builtPages.has('/')) fail('missing-built-home', 'index.md', 'Production homepage missing.');
    for (const [route, page] of builtPages) await checkHtml(route, page.html, builtPages, route, true);
  }
  return report();

  async function checkHtml(route: string, html: string, outputs: Map<string, HtmlOutput>, sourcePath: string, production: boolean) {
    for (const ref of htmlReferences(html)) {
      let url;
      try { url = new URL(ref.href, 'https://reader.invalid' + route); }
      catch { fail('invalid-rendered-url', sourcePath, ref.href); continue; }
      if (url.origin !== 'https://reader.invalid') {
        if (ref.type === 'link') checks.externalLinks++;
        continue;
      }
      const target = decodeURIComponent(url.pathname).replace(/\.html$/, '');
      if (ref.type === 'link' && ref.node.tagName === 'a' && !target.startsWith('/assets/') && !target.startsWith('/course-assets/')) {
        if (target === '/' && !production) continue;
        checks.localLinks++;
        const destination = outputs.get(target);
        if (!destination) fail('broken-internal-link', sourcePath, ref.href);
        else if (url.hash) {
          checks.anchors++;
          if (!destination.ids.has(decodeURIComponent(url.hash.slice(1)))) fail('broken-anchor', sourcePath, ref.href);
        }
      } else if (ref.type === 'image' || (production && (target.startsWith('/assets/') || ref.node.tagName === 'link'))) {
        if (['img', 'source', 'video'].includes(ref.node.tagName ?? '')) checks.images++;
        else checks.staticAssets++;
        const file = path.join(production ? distRoot : path.join(docsRoot, 'public'), decodeURIComponent(url.pathname).slice(1));
        try { await access(file); } catch { fail('broken-rendered-asset', sourcePath, ref.href); }
      } else if (ref.type === 'link' && !['#', ''].includes(ref.href) && !ref.href.startsWith('/assets/')) {
        fail('unresolved-local-link', sourcePath, ref.href);
      }
    }
  }

  function report() {
    const unique = [...new Map(findings.map((entry) => [JSON.stringify(entry), entry])).values()];
    const errors = unique.filter((entry) => entry.level === 'error');
    const warnings = unique.filter((entry) => entry.level === 'warning');
    return {
      generatedAt: new Date().toISOString(), source: manifest.source, sourceCommit: manifest.sourceCommit,
      passed: errors.length === 0, errors: errors.length, warnings: warnings.length,
      scope: 'Offline source, catalog, parsed URLs, Markdown rendering and local assets; remote HTTP availability, video playback and notebook/code execution are not tested.',
      counts: {
        modules: manifest.modules.filter((module) => module.kind === 'module').length,
        projectGroups: manifest.modules.filter((module) => module.kind === 'projects').length,
        lessons: manifest.pages.filter((page) => page.kind === 'lesson').length,
        guides: manifest.pages.filter((page) => page.kind === 'guide').length,
        pages: manifest.pages.length, assets: manifest.assets.length,
        lessonsWithoutVideo: manifest.pages.filter((page) => page.kind === 'lesson' && !page.video_url).map((page) => page.sourcePath)
      },
      modules: manifest.modules.map((module) => ({ slug: module.slug, title: module.title, inSyllabus: module.inSyllabus, lessons: module.lessons.length, guides: module.guides.length })),
      checks, findings: unique
    };
  }
}
