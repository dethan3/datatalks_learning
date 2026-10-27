import type { CourseManifest } from '../../src/types/course.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, cp, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { discoverCourse, generatedMarkdown, hash, repository, schemaVersion } from '../lib/course.ts';
import { validateCourse, courseRenderer, renderPages } from '../lib/validate.ts';

test('quality gate passes a complete fixture and fails missing pages, images, duplicate entries and invalid videos', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'course-validation-'));
  const sourceRoot = path.join(root, 'source');
  const docsRoot = path.join(root, 'docs');
  const commit = 'b'.repeat(40);
  const files = {
    'README.md': '# Course\n\n[Module 1](01-intro/)\n',
    '01-intro/README.md': '# Module 1\n\n[Start](01-start.md)\n',
    '01-intro/01-start.md': '---\nvideo_url: https://youtu.be/Crm_5n4mvmg\n---\n# Start\n\n![Image](images/a.png)\n\n[Details](#details)\n\n## Details\n\n| A | B |\n| --- | --- |\n| x | y |\n\n```python\nprint("example")\n```\n\n$$x^2$$\n',
    '01-intro/images/a.png': 'fixture-image'
  };
  try {
    for (const [file, body] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(sourceRoot, file)), { recursive: true });
      await writeFile(path.join(sourceRoot, file), body);
    }
    const inventory = new Set(Object.keys(files));
    const discovered = await discoverCourse(sourceRoot, inventory, commit);
    const manifest: CourseManifest = { schemaVersion, source: repository, sourceCommit: commit, modules: discovered.modules, pages: [], diagnostics: discovered.diagnostics, assets: [{ sourcePath: '01-intro/images/a.png', hash: hash(files['01-intro/images/a.png']) }] };
    for (const page of discovered.pages.values()) {
      const markdown = generatedMarkdown(page);
      await mkdir(path.dirname(path.join(docsRoot, 'course', page.sourcePath)), { recursive: true });
      await writeFile(path.join(docsRoot, 'course', page.sourcePath), markdown);
      const { body, references, metadata, ...entry } = page;
      manifest.pages.push({ ...entry, generatedHash: hash(markdown) });
    }
    const assetFile = path.join(docsRoot, 'public/course-assets/01-intro/images/a.png');
    await mkdir(path.dirname(assetFile), { recursive: true });
    await writeFile(assetFile, files['01-intro/images/a.png']);
    const snapshot = { commit, inventory: [...inventory] };
    const validate = () => validateCourse({ docsRoot, sourceRoot, snapshot, manifest });
    const result = await validate();
    assert.equal(result.passed, true, JSON.stringify(result.findings));
    assert.ok(result.checks.math > 0);
    assert.equal(result.checks.tables, 1);
    assert.equal(result.checks.codeBlocks, 1);

    const renderer = await courseRenderer(docsRoot, manifest);
    const rendered = await renderPages(docsRoot, manifest, renderer);
    const distRoot = path.join(root, 'dist');
    await mkdir(path.join(distRoot, 'assets'), { recursive: true });
    await writeFile(path.join(distRoot, 'vp-icons.css'), '/* fixture icon styles */');
    await writeFile(path.join(distRoot, 'assets/app.js'), '// fixture bundle');
    await writeFile(path.join(distRoot, 'index.html'), '<h1 id="home">Home</h1>');
    await cp(path.join(docsRoot, 'public/course-assets'), path.join(distRoot, 'course-assets'), { recursive: true });
    for (const [route, { html }] of rendered) {
      const file = path.join(distRoot, route.slice(1) + '.html');
      await mkdir(path.dirname(file), { recursive: true });
      const source = manifest.pages.find((page) => page.route === route)!.sourceUrl;
      await writeFile(file, `<html><head><link rel="stylesheet" href="/vp-icons.css"><script src="/assets/app.js"></script></head><body>${html}<section class="lesson-footer-note"><a href="${source}">Official source</a></section></body></html>`);
    }
    const validateBuilt = () => validateCourse({ docsRoot, sourceRoot, snapshot, manifest, built: true, distRoot });
    const builtResult = await validateBuilt();
    assert.equal(builtResult.passed, true, JSON.stringify(builtResult.findings));
    const builtLessonFile = path.join(distRoot, 'course/01-intro/01-start.html');
    const attributedHtml = await readFile(builtLessonFile, 'utf8');
    await writeFile(builtLessonFile, attributedHtml.replace('class="lesson-footer-note"', 'class="missing-source-panel"'));
    assert.ok((await validateBuilt()).findings.some((entry) => entry.code === 'missing-built-source-attribution'));
    await writeFile(builtLessonFile, attributedHtml);

    await rm(path.join(distRoot, 'vp-icons.css'));
    assert.ok((await validateBuilt()).findings.some((entry) => entry.code === 'broken-rendered-asset'));

    await rm(assetFile);
    const missingImage = await validate();
    assert.equal(missingImage.passed, false);
    assert.ok(missingImage.findings.some((entry) => entry.code === 'missing-asset'));
    await writeFile(assetFile, files['01-intro/images/a.png']);

    const removedPage = manifest.pages.pop()!;
    const missingPage = await validate();
    assert.equal(missingPage.passed, false);
    assert.ok(missingPage.findings.some((entry) => entry.code === 'missing-page'));
    manifest.pages.push(removedPage);

    manifest.modules[0].lessons.push({ ...manifest.modules[0].lessons[0] });
    assert.ok((await validate()).findings.some((entry) => entry.code === 'chapter-coverage'));
    manifest.modules[0].lessons.pop();

    removedPage.video_url = 'https://youtube.com/watch?v=invalid';
    assert.ok((await validate()).findings.some((entry) => entry.code === 'video-url'));
    removedPage.video_url = 'https://youtu.be/Crm_5n4mvmg';

    await rm(path.join(docsRoot, 'course/01-intro/01-start.md'));
    assert.ok((await validate()).findings.some((entry) => entry.code === 'missing-page-file'));
  } finally { await rm(root, { recursive: true, force: true }); }
});
