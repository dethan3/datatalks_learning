import { youtubeVideoId } from '../../src/lib/youtube.ts';
import type MarkdownItToken from 'markdown-it/lib/token.mjs';
import type { CourseManifest, CourseModule, Diagnostic, DocumentNode, HtmlReference, MarkdownCatalog, PageKind, Reference, ReferenceType, ResolvedReference, ResourceKind, SourceMetadata, SourcePage } from '../../src/types/course.ts';
import type { PluginSimple } from 'markdown-it';
import { machineLearning } from '../../src/config/courses.ts';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import MarkdownIt from 'markdown-it';
import matter from 'gray-matter';
import { parseFragment, html as htmlTags } from 'parse5';

export const repository = machineLearning.repository;
export const schemaVersion = 2;
export const parser = new MarkdownIt({ html: true, linkify: true });
parser.linkify.set({ fuzzyLink: false });
const upstreamFixes: { sourcePath: string; href: string; target: string; reason: string }[] = JSON.parse(await readFile(new URL('../upstream-link-fixes.json', import.meta.url), 'utf8'));
export const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
export const routeFor = (file: string) => `/course/${file.replace(/\.md$/i, '')}`;
export const assetUrl = (file: string) => `/course-assets/${file.split('/').map(encodeURIComponent).join('/')}`;
export const sourceUrl = (file: string, commit: string, directory = false) => `${repository}/${directory ? 'tree' : 'blob'}/${commit}/${file.split('/').map(encodeURIComponent).join('/')}`;
export const escapeHtml = (value: unknown) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);
export const readMarkdown = async (root: string, file: string) => {
  const parsed = matter((await readFile(path.join(root, file), 'utf8')).replace(/^\uFEFF/, ''));
  return { ...parsed, data: parsed.data as SourceMetadata };
};

export function walkHtml(html: string, visit: (node: DocumentNode) => void) {
  const document = parseFragment(html, { sourceCodeLocationInfo: true });
  function walk(node: DocumentNode) {
    visit(node);
    for (const child of node.childNodes ?? []) walk(child);
    if (node.content) walk(node.content);
  }
  walk(document);
}

export function htmlReferences(html: string): HtmlReference[] {
  const refs: HtmlReference[] = [];
  walkHtml(html, (node) => {
    for (const attr of node.attrs ?? []) {
      const type = attr.name === 'href' ? 'link' : ['src', 'poster'].includes(attr.name) ? 'image' : null;
      if (type) refs.push({ type, href: attr.value, node, attr });
      if (attr.name === 'srcset') {
        for (const item of attr.value.split(',')) {
          const href = item.trim().split(/\s+/)[0];
          if (href) refs.push({ type: 'image', href, node, attr, srcset: true });
        }
      }
    }
  });
  return refs;
}

export function tokensIn(tokens: MarkdownItToken[], visit: (token: MarkdownItToken) => void) {
  for (const token of tokens) {
    visit(token);
    if (token.children) tokensIn(token.children, visit);
  }
}

export function escapeDocumentPlaceholders(html: string) {
  return html.replace(/<\/?([a-z][\w:-]*)\b[^>]*>/gi, (tag, name) => htmlTags.getTagID(name.toLowerCase()) === htmlTags.TAG_ID.UNKNOWN ? escapeHtml(tag) : tag);
}

export function markdownReferences(body: string) {
  const refs: Reference[] = [];
  tokensIn(parser.parse(body, {}), (token) => {
    if (token.type === 'link_open') refs.push({ type: 'link', href: token.attrGet('href') ?? '' });
    if (token.type === 'image') refs.push({ type: 'image', href: token.attrGet('src') ?? '' });
    if (['html_inline', 'html_block'].includes(token.type)) {
      refs.push(...htmlReferences(token.content).map(({ type, href }) => ({ type, href })));
    }
  });
  return refs;
}

// Return repository paths only for this exact repository, current branch or pinned revision.
// Other branches, previous cohorts and third-party URLs retain their original destinations.
export function repositoryTarget(from: string, href: string, inventory: ReadonlySet<string>, commit: string) {
  if (typeof href !== 'string') return null;
  let parsed;
  try { parsed = new URL(href, 'https://reader.invalid/'); } catch { return null; }
  const suffix = parsed.search + parsed.hash;
  let file: string;
  if (/^(?:https?:)?\/\//.test(href)) {
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parsed.hostname === 'github.com' && parts[0] === 'DataTalksClub' && parts[1] === 'machine-learning-zoomcamp' && ['blob', 'tree', 'raw'].includes(parts[2]) && ['main', commit].includes(parts[3])) {
      file = parts.slice(4).join('/');
    } else if (parsed.hostname === 'raw.githubusercontent.com' && parts[0] === 'DataTalksClub' && parts[1] === 'machine-learning-zoomcamp' && ['main', commit].includes(parts[2])) {
      file = parts.slice(3).join('/');
    } else return null;
  } else {
    if (/^[a-z][a-z\d+.-]*:/i.test(href)) return null;
    try {
      file = href.startsWith('#') || href.startsWith('?') ? from : path.posix.normalize(path.posix.join(href.startsWith('/') ? '' : path.posix.dirname(from), decodeURIComponent(parsed.pathname.replace(/^\//, ''))));
    } catch { return null; }
    // URL.pathname above is relative to a dummy root; resolve parent segments using the raw path.
    const rawPath = href.split(/[?#]/)[0];
    if (rawPath) {
      try { file = path.posix.normalize(rawPath.startsWith('/') ? decodeURIComponent(rawPath.slice(1)) : path.posix.join(path.posix.dirname(from), decodeURIComponent(rawPath))); } catch { return null; }
    }
  }
  try { file = decodeURI(file); } catch { return null; }
  file = file.replace(/\/$/, '') || 'README.md';
  if (file === '.') file = 'README.md';
  const isDirectory = !inventory.has(file) && [...inventory].some((entry) => entry.startsWith(`${file}/`));
  let correction;
  if (isDirectory && inventory.has(`${file}/README.md`)) file += '/README.md';
  else if (!inventory.has(file) && file.endsWith('.dm') && inventory.has(file.slice(0, -3) + '.md')) {
    correction = file;
    file = file.slice(0, -3) + '.md';
  }
  return { file, suffix, exists: inventory.has(file) || isDirectory, directory: isDirectory && !file.endsWith('.md'), correction };
}

export const videoId = youtubeVideoId;

export function resourceKind(file: string): ResourceKind {
  if (/\.ipynb$/i.test(file)) return 'notebook';
  if (/\.(csv|parquet|tsv|jsonl|zip|gz|tar|pkl|h5|hdf5|onnx|tflite|keras|pb|npy|npz)$/i.test(file)) return 'data-or-model';
  if (/\.(png|jpe?g|gif|webp|svg|avif|ico|pdf)$/i.test(file)) return 'asset';
  return 'code-or-support';
}

export function resolveReference(page: Pick<SourcePage, 'sourcePath'>, ref: Reference, context: { inventory: ReadonlySet<string>; pages: ReadonlyMap<string, unknown>; commit: string }): ResolvedReference {
  const { inventory, pages, commit } = context;
  let target = repositoryTarget(page.sourcePath, ref.href, inventory, commit);
  const fix = target && !target.exists && upstreamFixes.find((entry) => entry.sourcePath === page.sourcePath && entry.href === ref.href);
  if (fix) {
    const replacement = repositoryTarget('README.md', fix.target, inventory, commit);
    if (!replacement?.exists) throw new Error(`Reviewed link correction no longer exists: ${fix.target}`);
    target = { ...replacement, correction: `${ref.href} → ${fix.target}: ${fix.reason}` };
  }
  if (!target) {
    let url = ref.href;
    // A GitHub blob page is HTML, not an image. Use the raw representation for external images.
    if (ref.type === 'image' && /^https:\/\/github\.com\/[^/]+\/[^/]+\/blob\//.test(url)) url = url.replace('https://github.com/', 'https://raw.githubusercontent.com/').replace('/blob/', '/');
    const safe = /^(https?:|mailto:|tel:|data:image\/|#)/i.test(url);
    return { ...ref, url, status: safe ? 'external' : 'unsupported-url', kind: 'external' };
  }
  const result = { ...ref, repoPath: target.file, correction: target.correction, suffix: target.suffix };
  if (!target.exists) return { ...result, url: sourceUrl(target.file, commit) + target.suffix, status: 'upstream-missing', kind: ref.type === 'image' ? 'asset' : resourceKind(target.file) };
  if (ref.type === 'image') return { ...result, url: assetUrl(target.file) + target.suffix, status: 'local', kind: 'asset' };
  if (pages.has(target.file)) return { ...result, url: routeFor(target.file) + target.suffix, status: 'local', kind: 'page' };
  return { ...result, url: sourceUrl(target.file, commit, target.directory) + target.suffix, status: 'upstream-resource', kind: target.directory ? 'directory' : resourceKind(target.file) };
}

export async function discoverCourse(sourceRoot: string, inventory: ReadonlySet<string>, commit: string) {
  const diagnostics: Diagnostic[] = [];
  const diagnose = (code: string, sourcePath: string, message: string, extra: Partial<Diagnostic> = {}) => diagnostics.push({ level: 'warning', code, sourcePath, message, ...extra });
  const rootReadme = await readMarkdown(sourceRoot, 'README.md');
  const syllabus: string[] = [];
  for (const ref of markdownReferences(rootReadme.content)) {
    const target = repositoryTarget('README.md', ref.href, inventory, commit);
    if (!target) continue;
    const dir = target.file.split('/')[0];
    if (/^\d\d-/.test(dir) || dir === 'projects') {
      if (!syllabus.includes(dir)) syllabus.push(dir);
    }
  }
  const numbered = [...new Set([...inventory].map((file) => file.split('/')[0]).filter((dir) => /^\d\d-/.test(dir)))].sort();
  const moduleDirs = [...syllabus, ...numbered.filter((dir) => !syllabus.includes(dir))];
  const pages = new Map<string, SourcePage>();
  const modules: CourseModule[] = [];
  async function addPage(file: string, kind: PageKind, moduleSlug: string | null, indexedBy: string): Promise<SourcePage> {
    if (pages.has(file)) return pages.get(file)!;
    if (!inventory.has(file)) throw new Error(`Expected course page does not exist: ${file}`);
    const parsed = await readMarkdown(sourceRoot, file);
    const heading = parsed.content.match(/^#{1,6}\s+(.+)$/m)?.[1]?.trim();
    const title = parsed.data.title ?? heading ?? path.posix.basename(file, '.md');
    const refs = markdownReferences(parsed.content);
    const embeddedVideo = refs.find((ref) => ref.type === 'link' && videoId(ref.href))?.href;
    const page: SourcePage = {
      links: [], navigation: {},
      sourcePath: file, route: routeFor(file), title, kind, moduleSlug, indexedBy,
      sourceUrl: sourceUrl(file, commit), sourceHash: hash(await readFile(path.join(sourceRoot, file))),
      video_url: parsed.data.video_url ?? embeddedVideo ?? null,
      videoOrigin: parsed.data.video_url ? 'frontmatter' : embeddedVideo ? 'body' : null,
      prev_url: parsed.data.prev_url ?? null, next_url: parsed.data.next_url ?? null,
      metadata: parsed.data, body: parsed.content, references: refs
    };
    pages.set(file, page);
    tokensIn(parser.parse(page.body, {}), (token) => {
      if (['html_inline', 'html_block'].includes(token.type) && escapeDocumentPlaceholders(token.content) !== token.content) diagnose('escaped-html-placeholder', file, `Document placeholder is rendered as text instead of a Vue/HTML element: ${token.content.trim().slice(0, 120)}`);
    });
    return page;
  }
  await addPage('README.md', 'overview', null, 'repository README');
  for (const dir of moduleDirs) {
    const readmeFile = `${dir}/README.md`;
    if (!inventory.has(readmeFile)) throw new Error(`Module README missing: ${readmeFile}`);
    const readme = await addPage(readmeFile, 'module', dir, 'repository README / directory');
    const module: CourseModule = { slug: dir, title: readme.title, route: readme.route, inSyllabus: syllabus.includes(dir), kind: dir === 'projects' ? 'projects' : 'module', lessons: [], guides: [], expected: [] };
    modules.push(module);
    if (!module.inSyllabus) diagnose('module-outside-syllabus', readmeFile, 'Directory exists upstream but is not listed in the root syllabus; imported as supplemental/optional.');
    const expected: CourseModule['expected'] = [];
    const addExpected = (file: string, indexedBy: string) => {
      if (expected.some((entry) => entry.sourcePath === file)) {
        if (indexedBy === 'README') diagnose('duplicate-directory-reference', readmeFile, `Duplicate chapter reference: ${file}`);
        return;
      }
      expected.push({ sourcePath: file, indexedBy });
    };
    for (const ref of readme.references) {
      const target = repositoryTarget(readmeFile, ref.href, inventory, commit);
      if (target?.file.startsWith(`${dir}/`) && target.file.endsWith('.md') && target.file !== readmeFile) {
        if (target.correction) diagnose('corrected-extension', readmeFile, `Unambiguous upstream typo: ${target.correction} → ${target.file}`, { href: ref.href });
        addExpected(target.file, 'README');
      }
    }
    const yamlPath = `${dir}/module.yaml`;
    if (inventory.has(yamlPath)) {
      const yaml = matter(`---\n${await readFile(path.join(sourceRoot, yamlPath), 'utf8')}\n---\n`).data as { units?: { path: string }[] };
      for (const unit of yaml.units ?? []) {
        const file = path.posix.normalize(`${dir}/${unit.path}`);
        if (!expected.some((entry) => entry.sourcePath === file)) {
          addExpected(file, 'module.yaml');
          diagnose('chapter-outside-readme', file, 'Chapter is present in module.yaml but absent from README; included without inventing a chapter.');
        }
      }
    }
    const rootMarkdown = [...inventory].filter((file) => path.posix.dirname(file) === dir && file.endsWith('.md') && file !== readmeFile).sort();
    for (const file of rootMarkdown) if (!expected.some((entry) => entry.sourcePath === file)) {
      addExpected(file, 'directory');
      if (dir !== 'projects') diagnose('chapter-outside-index', file, 'Existing top-level Markdown not in module index; imported as supplemental material.');
    }
    module.expected = expected;
    for (const entry of expected) {
      const isLesson = /^\d/.test(path.posix.basename(entry.sourcePath)) && path.posix.dirname(entry.sourcePath) === dir;
      const page = await addPage(entry.sourcePath, isLesson ? 'lesson' : 'guide', dir, entry.indexedBy);
      (isLesson ? module.lessons : module.guides).push({ sourcePath: page.sourcePath, title: page.title, route: page.route, indexedBy: page.indexedBy });
    }
  }
  // Follow local Markdown/directory links from actual course pages, including workshops and nested guides.
  // Editorial provenance, code plans and older cohorts remain upstream resources, never fabricated lessons.
  const editorial = /(?:^|\/)(?:images?|assets?|code)\/|(?:visual-audit|provenance|removal-evidence)/i;
  for (const module of modules) {
    const guides = [...inventory].filter((file) => file.startsWith(`${module.slug}/`) && file.endsWith('.md') && !editorial.test(file) && !pages.has(file)).sort();
    for (const file of guides) {
      const guide = await addPage(file, 'guide', module.slug, 'directory');
      module.guides.push({ sourcePath: guide.sourcePath, title: guide.title, route: guide.route, indexedBy: guide.indexedBy });
      diagnose('guide-outside-index', file, 'Existing supplementary guide not linked directly by the module README; included from the module directory.');
    }
  }
  for (const page of pages.values()) {
    for (const ref of page.references) {
      if (ref.type !== 'link') continue;
      const target = repositoryTarget(page.sourcePath, ref.href, inventory, commit);
      if (!target?.exists || !target.file.endsWith('.md') || editorial.test(target.file)) continue;
      const module = modules.find((entry) => target.file.startsWith(`${entry.slug}/`));
      if (module && !pages.has(target.file)) {
        const guide = await addPage(target.file, 'guide', module.slug, page.sourcePath);
        module.guides.push({ sourcePath: guide.sourcePath, title: guide.title, route: guide.route, indexedBy: guide.indexedBy });
      }
    }
  }
  for (const page of pages.values()) {
    page.links = page.references.map((ref) => resolveReference(page, ref, { inventory, pages, commit }));
    for (const ref of page.metadata.code ?? []) {
      page.links.push(resolveReference(page, { type: 'resource', href: ref.path, label: ref.label }, { inventory, pages, commit }));
    }
    for (const link of page.links) {
      if ('correction' in link && link.correction) diagnose('corrected-upstream-link', page.sourcePath, link.correction, { href: link.href, target: link.repoPath });
      if (link.status === 'external' && /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\//.test(link.href)) diagnose('local-service-example', page.sourcePath, 'Course example URL points to a service the learner starts locally; excluded explicitly from website-route dead-link checks.', { href: link.href });
      if (link.status === 'upstream-missing') diagnose('upstream-missing-target', page.sourcePath, `Upstream target does not exist: ${link.repoPath}. Retained an explicit official-source link.`, { href: link.href, target: link.repoPath, type: link.type });
      if (link.status === 'unsupported-url') diagnostics.push({ level: 'error', code: 'unsupported-url', sourcePath: page.sourcePath, href: link.href, message: 'Unsupported or unsafe URL protocol.' });
    }
    const module = modules.find((entry) => entry.slug === page.moduleSlug);
    const sequence = module?.lessons ?? [];
    const index = sequence.findIndex((entry) => entry.sourcePath === page.sourcePath);
    page.navigation = {};
    for (const [direction, key, offset] of [['previous', 'prev_url', -1], ['next', 'next_url', 1]] as const) {
      const raw = page[key];
      const target = raw ? repositoryTarget(page.sourcePath, raw, inventory, commit) : null;
      let destination = target && pages.get(target.file);
      let via: 'metadata' | 'module-order' = 'metadata';
      if (raw && !destination) diagnose('invalid-navigation-metadata', page.sourcePath, `Cannot resolve ${key}: ${raw}; using indexed neighbour when available.`);
      if (!destination && page.kind === 'lesson') {
        destination = pages.get(sequence[index + offset]?.sourcePath ?? '');
        via = 'module-order';
      }
      page.navigation[direction] = destination ? { sourcePath: destination.sourcePath, route: destination.route, title: destination.title, via } : null;
    }
  }
  return { modules, pages, diagnostics };
}

function rewriteHtml(html: string, resolve: (type: ReferenceType, href: string) => string) {
  const changes = new Map<string, { startOffset: number; endOffset: number; value: string }>();
  for (const ref of htmlReferences(html)) {
    const loc = ref.node.sourceCodeLocation?.attrs?.[ref.attr.name];
    if (!loc) continue;
    const key = `${loc.startOffset}:${loc.endOffset}`;
    if (ref.srcset) {
      changes.set(key, { ...loc, value: `srcset="${escapeHtml(ref.attr.value.split(',').map((item) => {
        const [url, ...size] = item.trim().split(/\s+/);
        return [resolve('image', url), ...size].join(' ');
      }).join(', '))}"` });
    } else changes.set(key, { ...loc, value: `${ref.attr.name}="${escapeHtml(resolve(ref.type, ref.href))}"` });
  }
  for (const edit of [...changes.values()].sort((a, b) => b.startOffset - a.startOffset)) html = html.slice(0, edit.startOffset) + edit.value + html.slice(edit.endOffset);
  return html;
}

export function courseMarkdownPlugin(manifest: MarkdownCatalog): PluginSimple {
  const pages = new Map((manifest.pages ?? []).map((page) => [page.sourcePath, page]));
  return (md) => {
    if (md.renderer.rules.math_inline) {
      // GitHub accepts $$...$$ inside a list paragraph; the default MathJax plugin only
      // recognizes $$ at the beginning of a block. Parse this variant without changing source.
      md.inline.ruler.before('math_inline', 'course-inline-display-math', (state, silent) => {
        if (!state.src.startsWith('$$', state.pos)) return false;
        const end = state.src.indexOf('$$', state.pos + 2);
        if (end < 0) return false;
        const content = state.src.slice(state.pos + 2, end);
        if (!content.trim() || content.includes('\n')) return false;
        if (!silent) {
          const token = state.push('math_inline', 'math', 0);
          token.content = content;
          token.markup = '$$';
        }
        state.pos = end + 2;
        return true;
      });
    }
    md.core.ruler.after('inline', 'course-resources', (state) => {
      const sourcePath = state.env.relativePath?.replace(/^course\//, '');
      const page = pages.get(sourcePath);
      if (!page) return;
      const links = new Map(page.links.map((link) => [`${link.type}:${link.href}`, link.url]));
      const resolve = (type: ReferenceType, href: string) => links.get(`${type}:${href}`) ?? href;
      tokensIn(state.tokens, (token) => {
        if (token.type === 'link_open') token.attrSet('href', resolve('link', token.attrGet('href') ?? ''));
        if (token.type === 'image') token.attrSet('src', resolve('image', token.attrGet('src') ?? ''));
        if (['html_inline', 'html_block'].includes(token.type)) token.content = escapeDocumentPlaceholders(rewriteHtml(token.content, resolve));
      });
    });
    // Course prose and code are documents, not Vue templates. Preserve literal template braces.
    const text = md.renderer.rules.text;
    md.renderer.rules.text = (...args) => (text ? text(...args) : md.utils.escapeHtml(args[0][args[1]].content)).replaceAll('{{', '&#123;&#123;').replaceAll('}}', '&#125;&#125;');
  };
}

export function generatedMarkdown(page: Pick<SourcePage, 'body' | 'metadata' | 'video_url' | 'title' | 'navigation' | 'links' | 'sourcePath' | 'moduleSlug' | 'kind' | 'sourceUrl'>) {
  const links = [];
  if (page.navigation.previous) links.push(`<a href="${escapeHtml(page.navigation.previous.route)}">← Previous: ${escapeHtml(page.navigation.previous.title)}</a>`);
  if (page.navigation.next) links.push(`<a href="${escapeHtml(page.navigation.next.route)}">Next: ${escapeHtml(page.navigation.next.title)} →</a>`);
  const navigation = links.length ? `\n\n---\n\n<div class="lesson-navigation">\n${links.join('\n')}\n</div>\n` : '\n';
  const resources = page.links.filter((link) => link.type === 'resource');
  const resourceLinks = resources.length ? '\n\n## Official code resources\n\n' + resources.map((link) => `- [${String(link.label ?? ('repoPath' in link ? link.repoPath : link.href)).replace(/[\[\]]/g, '')}](${link.url})`).join('\n') + '\n' : '';
  const metadata = {
    ...page.metadata, ...(page.video_url ? { video_url: page.video_url } : {}), prev: false, next: false,
    reader: { sourcePath: page.sourcePath, sourceUrl: page.sourceUrl, moduleSlug: page.moduleSlug, kind: page.kind, title: page.title }
  };
  // The source body remains byte-for-byte intact; resource resolution happens in a shared renderer plugin.
  const attribution = page.kind !== 'lesson' ? `\n\n[Official source](${page.sourceUrl})\n` : '';
  return matter.stringify(page.body + resourceLinks + navigation + attribution, metadata);
}
