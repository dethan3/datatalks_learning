import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';
import mathjax from 'markdown-it-mathjax3';
import { courseMarkdownPlugin, discoverCourse, generatedMarkdown, markdownReferences, repositoryTarget, resolveReference, videoId } from '../lib/course.ts';

const commit = 'a'.repeat(40);
const inventory = new Set(['README.md', '01-intro/README.md', '01-intro/01-start.md', '01-intro/02-next.md', '02-regression/01-start.md', '01-intro/images/car with spaces.png', '01-intro/code/demo.ipynb', '01-intro/code/train.py']);

test('relative links retain complete paths, encoded images, queries, fragments and directory READMEs', () => {
  assert.equal(repositoryTarget('01-intro/01-start.md', '../02-regression/01-start.md#model', inventory, commit)?.file, '02-regression/01-start.md');
  assert.equal(repositoryTarget('01-intro/01-start.md', 'images/car%20with%20spaces.png', inventory, commit)?.file, '01-intro/images/car with spaces.png');
  assert.equal(repositoryTarget('01-intro/01-start.md', '#heading', inventory, commit)?.suffix, '#heading');
  assert.equal(repositoryTarget('01-intro/01-start.md', './', inventory, commit)?.file, '01-intro/README.md');
  assert.equal(repositoryTarget('01-intro/01-start.md', 'https://example.org/a.md', inventory, commit), null);
  assert.equal(repositoryTarget('01-intro/01-start.md', 'https://github.com/DataTalksClub/machine-learning-zoomcamp/blob/old/01-intro/02-next.md', inventory, commit), null);
});

test('Markdown parsing handles references, HTML, tables and nested parentheses, and never scans code samples', () => {
  const body = '[Next][unit]\n\n[unit]: 02-next.md#topic\n\n![Photo](<images/car with spaces.png>)\n\n<a href="../02-regression/01-start.md"><img src="images/car%20with%20spaces.png"></a>\n\n| Item | Link |\n| --- | --- |\n| A | [Data](https://example.org/a_(b)) |\n\n```md\n[Not a link](missing.md)\n```\n\n`[Neither](missing.md)`';
  const refs = markdownReferences(body);
  assert.equal(refs.length, 5);
  assert.ok(refs.some((entry) => entry.href === '02-next.md#topic'));
  assert.ok(refs.some((entry) => entry.href === 'https://example.org/a_(b)'));
  assert.ok(!refs.some((entry) => entry.href.includes('missing.md')));
});

test('auxiliary resources stay pinned upstream, imported pages and images resolve locally', () => {
  const context = { inventory, commit, pages: new Map([['01-intro/02-next.md', {}]]) };
  const page = { sourcePath: '01-intro/01-start.md' };
  assert.equal(resolveReference(page, { type: 'link', href: '02-next.md' }, context).url, '/course/01-intro/02-next');
  const notebook = resolveReference(page, { type: 'link', href: 'code/demo.ipynb' }, context);
  assert.equal(notebook.kind, 'notebook');
  assert.ok(notebook.url.includes(`/blob/${commit}/01-intro/code/demo.ipynb`));
  assert.equal(resolveReference(page, { type: 'link', href: 'missing.md' }, context).status, 'upstream-missing');
  assert.equal(resolveReference(page, { type: 'image', href: 'images/car%20with%20spaces.png' }, context).url, '/course-assets/01-intro/images/car%20with%20spaces.png');
  assert.equal(resolveReference(page, { type: 'link', href: 'javascript:alert(1)' }, context).status, 'unsupported-url');
});

test('video parsing supports watch, short, embed, live and shorts URLs with exact host validation', () => {
  for (const url of ['https://www.youtube.com/watch?v=Crm_5n4mvmg&t=4s', 'https://youtu.be/Crm_5n4mvmg', 'https://youtube-nocookie.com/embed/Crm_5n4mvmg', 'https://youtube.com/live/Crm_5n4mvmg', 'https://youtube.com/shorts/Crm_5n4mvmg']) assert.equal(videoId(url), 'Crm_5n4mvmg');
  for (const url of ['https://fake.youtube.com/watch?v=Crm_5n4mvmg', 'https://youtube.com/playlist?list=123', 'https://youtu.be/short', 'javascript:alert(1)']) assert.equal(videoId(url), null);
});

test('source bodies survive generation, including pages without optional video metadata', () => {
  const body = '\n# Text\n\n```python\nprint("{{example}}")\n```\n';
  const output = generatedMarkdown({ body, metadata: {}, video_url: null, title: 'Text', navigation: {}, links: [], sourcePath: '01-intro/01-start.md', moduleSlug: '01-intro', kind: 'lesson', sourceUrl: 'https://example.org/source' });
  assert.ok(matter(output).content.startsWith(body));
  assert.equal(matter(output).data.video_url, undefined);
});

test('renderer rewrites Markdown references and raw HTML resources without touching code', () => {
  const md = new MarkdownIt({ html: true });
  md.use(courseMarkdownPlugin({ pages: [{ sourcePath: '01-intro/01-start.md', links: [
    { type: 'link', href: '02-next.md', url: '/course/01-intro/02-next' },
    { type: 'image', href: 'images/a.png', url: '/course-assets/01-intro/images/a.png' }
  ] }] }));
  const html = md.render('[Next][n]\n\n[n]: 02-next.md\n\n<img alt="A" src="images/a.png">\n\n```md\n[Code](02-next.md)\n```', { relativePath: 'course/01-intro/01-start.md' });
  assert.ok(html.includes('href="/course/01-intro/02-next"'));
  assert.ok(html.includes('src="/course-assets/01-intro/images/a.png"'));
  assert.ok(html.includes('[Code](02-next.md)'));
});

test('document key placeholders are text while legitimate HTML subscripts remain markup', () => {
  const md = new MarkdownIt({ html: true }).use(courseMarkdownPlugin({ pages: [{ sourcePath: '01-intro/01-start.md', links: [] }] }));
  const html = md.render('Press <ENTER> and read x<sub>i</sub>.', { relativePath: 'course/01-intro/01-start.md' });
  assert.ok(html.includes('&lt;ENTER&gt;'));
  assert.ok(html.includes('<sub>i</sub>'));
});

test('inline display math in list prose renders and never consumes fenced dollar examples', () => {
  const md = new MarkdownIt().use(mathjax).use(courseMarkdownPlugin({ pages: [] }));
  const html = md.render('* Apply the model $$\\\\\\\\ \\large g(X) = w_0 + X \\cdot w$$ for predictions.\n\n```text\n$$example$$\n```');
  assert.ok(html.includes('<mjx-container'));
  assert.ok(!html.includes('<mjx-merror'));
  assert.match(html, /<code[^>]*>\$\$example\$\$/);
  assert.ok(!html.includes('model $$'));
});

test('catalog discovery detects README omissions, imports nested workshops and resolves cross-module navigation', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'course-fixture-'));
  try {
    const files = {
      'README.md': '# Course\n\n### [Module 1](01-intro/)\n\n### [Module 2](02-regression/)',
      '01-intro/README.md': '# Module 1\n\n[Start](01-start.md)\n\n[Workshop](workshop/)\n\n[Typo](02-next.dm)',
      '01-intro/01-start.md': '---\nnext_url: 02-next.md\n---\n# Start\n',
      '01-intro/02-next.md': '---\nprev_url: 01-start.md\nnext_url: ../02-regression/01-start.md\n---\n# Next\n',
      '01-intro/03-extra.md': '# Existing supplemental chapter\n',
      '01-intro/workshop/README.md': '# Workshop\n\n[Install](install.md)\n',
      '01-intro/workshop/install.md': '# Installation\n',
      '01-intro/images/provenance.md': '# Editorial log, not a lesson\n',
      '02-regression/README.md': '# Module 2\n\n[Start](01-start.md)\n',
      '02-regression/01-start.md': '---\nprev_url: ../01-intro/02-next.md\n---\n# Module 2 start\n'
    };
    for (const [file, content] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(dir, file)), { recursive: true });
      await writeFile(path.join(dir, file), content);
    }
    const result = await discoverCourse(dir, new Set(Object.keys(files)), commit);
    assert.equal(result.modules.length, 2);
    assert.equal(result.modules[0].lessons.length, 3);
    assert.ok(result.pages.has('01-intro/workshop/install.md'));
    assert.ok(!result.pages.has('01-intro/images/provenance.md'));
    assert.equal(result.pages.get('01-intro/02-next.md')?.navigation.next?.route, '/course/02-regression/01-start');
    assert.ok(result.diagnostics.some((entry) => entry.code === 'corrected-extension'));
    assert.ok(result.diagnostics.some((entry) => entry.code === 'chapter-outside-index'));
    await rm(path.join(dir, '01-intro/02-next.md'));
    await assert.rejects(() => discoverCourse(dir, new Set(Object.keys(files)), commit), /ENOENT/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
