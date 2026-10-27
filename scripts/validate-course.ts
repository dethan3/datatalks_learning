import type { CourseManifest, SourceSnapshot } from '../src/types/course.ts';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { validateCourse } from './lib/validate.ts';

const root = path.resolve(import.meta.dirname, '..');
const { values } = parseArgs({ options: { built: { type: 'boolean', default: false } } });
try {
  const manifest: CourseManifest = JSON.parse(await readFile(path.join(root, 'docs/course-manifest.json'), 'utf8'));
  const snapshot: SourceSnapshot = JSON.parse(await readFile(path.join(root, '.cache/course/snapshot.json'), 'utf8'));
  const result = await validateCourse({ docsRoot: path.join(root, 'docs'), sourceRoot: path.join(root, '.cache/course/source'), snapshot, manifest, built: values.built });
  await mkdir(path.join(root, 'reports'), { recursive: true });
  await writeFile(path.join(root, 'reports/course-quality.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(`${result.passed ? 'PASS' : 'FAIL'}: ${result.counts.modules} modules, ${result.counts.lessons} lessons, ${result.counts.guides} guides, ${result.counts.assets} assets.`);
  console.log(`${result.errors} errors, ${result.warnings} diagnostics. Checks: ${JSON.stringify(result.checks)}`);
  for (const error of result.findings.filter((entry) => entry.level === 'error')) console.error(`${error.code}: ${error.sourcePath}: ${error.message}`);
  console.log('Full report: reports/course-quality.json');
  process.exitCode = result.passed ? 0 : 1;
} catch (caught) { const error = caught instanceof Error ? caught : new Error(String(caught));
  console.error('Course validation could not finish:', error.message);
  console.error('Run pnpm sync:course to create the source snapshot and current manifest.');
  process.exitCode = 1;
}
