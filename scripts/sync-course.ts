import type { CourseManifest } from '../src/types/course.ts';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, cp, readFile, writeFile, rm, rename, access } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { parseArgs } from 'node:util';
import { discoverCourse, generatedMarkdown, hash, repository, schemaVersion } from './lib/course.ts';
import { courseRenderer, diagnoseAnchors, renderPages, validateCourse } from './lib/validate.ts';

const root = path.resolve(import.meta.dirname, '..');
const { values } = parseArgs({ options: { source: { type: 'string' }, ref: { type: 'string', default: 'main' } } });
const workspace = await mkdtemp(path.join(os.tmpdir(), 'ml-zoomcamp-sync-'));
const repo = values.source ? path.resolve(values.source) : path.join(workspace, 'upstream');
const stage = path.join(workspace, 'stage');
const stagedDocs = path.join(stage, 'docs');
const stagedSource = path.join(stage, 'source');
let published = false;
function git(args: string[], capture: true): string;
function git(args: string[], capture?: false): Buffer;
function git(args: string[], capture = false): string | Buffer {
  return execFileSync('git', ['-C', repo, ...args], {
    encoding: capture ? 'utf8' : undefined, stdio: capture ? ['pipe', 'pipe', 'pipe'] : 'inherit', maxBuffer: 32 * 1024 * 1024
  });
}
function materialize(files: string[]) {
  // Avoid fetching datasets and model weights. Fetch only selected Markdown and referenced assets.
  let sparse;
  try { sparse = git(['config', '--get', 'core.sparseCheckout'], true).trim(); }
  catch (caught) { const error = caught as NodeJS.ErrnoException & { status?: number }; if (error.status === 1) return; throw error; }
  if (sparse !== 'true') return;
  const patterns = files.map((file) => '/' + file.replace(/[\\*?\[\]]/g, '\\$&')).join('\n') + '\n';
  execFileSync('git', ['-C', repo, 'sparse-checkout', 'set', '--no-cone', '--stdin'], { input: patterns, stdio: ['pipe', 'inherit', 'inherit'] });
}
async function writeJson(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 2) + '\n');
}
// Each generated tree is replaced with rollback. A failed fetch or validation never deletes the last good course.
async function publish(entries: [string, string][]) {
  const backups: { to: string; backup: string; existed: boolean }[] = [];
  try {
    for (const [from, to] of entries) {
      await mkdir(path.dirname(to), { recursive: true });
      const backup = to + '.sync-backup';
      try { await access(backup); throw new Error(`Previous interrupted sync backup exists: ${backup}`); }
      catch (caught) { const error = caught as NodeJS.ErrnoException & { status?: number }; if (error.code !== 'ENOENT') throw error; }
      let existed = false;
      try { await rename(to, backup); existed = true; } catch (caught) { const error = caught as NodeJS.ErrnoException & { status?: number }; if (error.code !== 'ENOENT') throw error; }
      backups.push({ to, backup, existed });
      // cp rather than rename: /tmp and the workspace may be on different filesystems.
      await cp(from, to, { recursive: true });
    }
  } catch (caught) { const error = caught as NodeJS.ErrnoException & { status?: number };
    for (const { to, backup, existed } of backups.reverse()) {
      await rm(to, { recursive: true, force: true });
      if (existed) await rename(backup, to);
    }
    throw error;
  }
  for (const { backup, existed } of backups) if (existed) await rm(backup, { recursive: true, force: true });
}
try {
  if (!values.source) {
    console.log(`Fetching official ML Zoomcamp (${values.ref})...`);
    execFileSync('git', ['clone', '--depth', '1', '--filter=blob:none', '--sparse', '--branch', values.ref, repository + '.git', repo], { stdio: 'inherit' });
  } else {
    // Local snapshots are explicit and must be clean. Never fetch/reset a caller's checkout.
    git(['diff', '--quiet', 'HEAD']);
    console.log(`Using official source checkout: ${repo}`);
  }
  const commit = git(['rev-parse', 'HEAD'], true).trim();
  const inventory = new Set(git(['ls-tree', '-rz', '--name-only', 'HEAD'], true).split('\0').filter(Boolean));
  const dirs = new Set([...inventory].map((file) => file.split('/')[0]).filter((dir) => /^\d\d-/.test(dir) || dir === 'projects'));
  const markdownFiles = [...inventory].filter((file) => file === 'README.md' || (dirs.has(file.split('/')[0]) && (file.endsWith('.md') || file.endsWith('/module.yaml'))));
  materialize(markdownFiles);
  const discovered = await discoverCourse(repo, inventory, commit);
  const assets = [...new Set([...discovered.pages.values()].flatMap((page) => page.links.flatMap((link) => link.kind === 'asset' && link.status === 'local' ? [link.repoPath] : [])))].sort();
  materialize([...markdownFiles, ...assets]);
  await mkdir(path.join(stagedDocs, 'course'), { recursive: true });
  await mkdir(path.join(stagedDocs, 'public/course-assets'), { recursive: true });
  await mkdir(stagedSource, { recursive: true });
  for (const file of markdownFiles) {
    await mkdir(path.dirname(path.join(stagedSource, file)), { recursive: true });
    await cp(path.join(repo, file), path.join(stagedSource, file));
  }
  const manifest: CourseManifest = {
    schemaVersion, source: repository, sourceBranch: values.ref, sourceCommit: commit,
    generatedAt: new Date().toISOString(),
    modules: discovered.modules, pages: [], assets: [], diagnostics: discovered.diagnostics
  };
  for (const page of discovered.pages.values()) {
    const output = path.join(stagedDocs, 'course', page.sourcePath);
    await mkdir(path.dirname(output), { recursive: true });
    const markdown = generatedMarkdown(page);
    await writeFile(output, markdown);
    const { body, references, metadata, ...entry } = page;
    manifest.pages.push({ ...entry, generatedHash: hash(markdown) });
  }
  for (const file of assets) {
    const output = path.join(stagedDocs, 'public/course-assets', file);
    await mkdir(path.dirname(output), { recursive: true });
    await cp(path.join(repo, file), output);
    manifest.assets.push({ sourcePath: file, hash: hash(await readFile(output)) });
  }
  const snapshot = { commit, source: repository, ref: values.ref, inventory: [...inventory].sort() };
  const renderer = await courseRenderer(stagedDocs, manifest);
  const rendered = await renderPages(stagedDocs, manifest, renderer);
  diagnoseAnchors(manifest, rendered);
  const result = await validateCourse({ docsRoot: stagedDocs, sourceRoot: stagedSource, snapshot, manifest });
  await writeJson(path.join(root, 'reports/course-quality.json'), result);
  if (!result.passed) {
    for (const error of result.findings.filter((entry) => entry.level === 'error')) console.error(`${error.code}: ${error.sourcePath}: ${error.message}`);
    throw new Error(`Course validation failed: ${result.errors} errors. Previous imported content is unchanged. See reports/course-quality.json.`);
  }
  await writeJson(path.join(stage, 'course-manifest.json'), manifest);
  await writeJson(path.join(stage, 'snapshot.json'), snapshot);
  await publish([
    [path.join(stagedDocs, 'course'), path.join(root, 'docs/course')],
    [path.join(stagedDocs, 'public/course-assets'), path.join(root, 'docs/public/course-assets')],
    [stagedSource, path.join(root, '.cache/course/source')],
    [path.join(stage, 'snapshot.json'), path.join(root, '.cache/course/snapshot.json')],
    [path.join(stage, 'course-manifest.json'), path.join(root, 'docs/course-manifest.json')]
  ]);
  published = true;
  console.log(`Synced ${result.counts.modules} modules, ${result.counts.projectGroups} project group, ${result.counts.lessons} lessons, ${result.counts.guides} guides, ${result.counts.assets} assets at ${commit}.`);
  console.log(`Validation: ${result.errors} errors, ${result.warnings} diagnostics. See reports/course-quality.json.`);
} catch (caught) { const error = caught as NodeJS.ErrnoException & { status?: number };
  console.error('\nCourse sync failed:', error.message);
  if (!published) console.error('Existing imported content has been preserved.');
  process.exitCode = 1;
} finally {
  await rm(workspace, { recursive: true, force: true });
}
