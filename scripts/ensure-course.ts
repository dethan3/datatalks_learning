import { access, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
try {
  const manifest = JSON.parse(await readFile(path.join(root, 'docs', 'course-manifest.json'), 'utf8'));
  if (manifest.schemaVersion !== 2) throw new Error('Course import needs upgrading');
  await access(path.join(root, '.cache/course/snapshot.json'));
  await access(path.join(root, 'docs/course', manifest.pages[0].sourcePath));
} catch {
  const result = spawnSync(process.execPath, ['--import', 'tsx', path.join(root, 'scripts', 'sync-course.ts')], { stdio: 'inherit', cwd: root });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
