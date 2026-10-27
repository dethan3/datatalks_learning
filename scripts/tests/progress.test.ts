import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyProgress, lessonPath, mergeProgress, migrateLegacyProgress, parseProgress, summarizeProgress, type CourseProgress } from '../../src/lib/progress.ts'
import type { ChapterEntry } from '../../src/types/course.ts'

const lessons: ChapterEntry[] = ['first', 'second', 'third'].map((name) => ({ route: `/course/module/${name}`, sourcePath: `${name}.md`, title: name, indexedBy: 'README.md' }))
const paths = lessons.map((lesson) => lesson.route)
const course = (completed: string[] = [], last: string | null = null): CourseProgress => ({ completed, lastVisited: last ? { path: last, at: '2026-10-27T06:00:00Z' } : null })

test('existing completion marks migrate without counting duplicates or invalid entries', () => {
  const migrated = migrateLegacyProgress(['course/module/first', '/course/module/first.md', null, 4, 'https://bad.example', '../bad', 'course/../bad'])
  assert.deepEqual(migrated.courses['machine-learning'], course([paths[0]]))
  assert.equal(lessonPath('course/module/first.md'), paths[0])
  assert.throws(() => lessonPath('/course/../bad'))
  assert.throws(() => migrateLegacyProgress({}))
})

test('course counts only real, unique lessons; removed lessons and guides do not inflate progress', () => {
  const summary = summarizeProgress([...lessons, lessons[0]], course([paths[0], paths[0], '/course/guide/example', '/course/module/removed']))
  assert.equal(summary.completed, 1)
  assert.equal(summary.total, 3)
  assert.equal(summary.percent, 33)
  assert.equal(summary.started, true)
  assert.equal(summary.finished, false)
  assert.equal(summarizeProgress([], course()).percent, 0)
  assert.equal(summarizeProgress([], course()).finished, false)
})

test('resume preserves unfinished last visit, then moves forward and wraps to earlier gaps', () => {
  assert.equal(summarizeProgress(lessons, course([], paths[1])).resume?.route, paths[1])
  assert.equal(summarizeProgress(lessons, course([paths[1]], paths[1])).resume?.route, paths[2])
  assert.equal(summarizeProgress(lessons, course([paths[1], paths[2]], paths[2])).resume?.route, paths[0])
  assert.equal(summarizeProgress(lessons, course([], '/course/removed/lesson')).resume?.route, paths[0])
  const finished = summarizeProgress(lessons, course(paths, paths[2]))
  assert.equal(finished.finished, true)
  assert.equal(finished.percent, 100)
  assert.equal(finished.resume?.route, paths[2])
})

test('unmarking a completed lesson changes both the count and next learning target', () => {
  const completed = course(paths, paths[1])
  const undone = { ...completed, completed: completed.completed.filter((path) => path !== paths[1]) }
  const summary = summarizeProgress(lessons, undone)
  assert.equal(summary.completed, 2)
  assert.equal(summary.finished, false)
  assert.equal(summary.resume?.route, paths[1])
})

test('backup merge is additive, validates catalog membership and preserves course isolation', () => {
  const current = { version: 1 as const, courses: { ml: course([paths[0]], paths[2]), another: course(['/other/module/lesson']) } }
  const incoming = { version: 1 as const, courses: { ml: { ...course([paths[0], paths[1], '/course/removed/lesson'], paths[1]), lastVisited: { path: paths[1], at: '2026-01-01T00:00:00Z' } }, unknown: course(['/unknown/module/lesson']), constructor: course(['/bad/module/lesson']) } }
  const result = mergeProgress(current, incoming, { ml: new Set(paths) })
  assert.equal(result.added, 1)
  assert.equal(result.ignored, 3)
  assert.deepEqual(result.state.courses.ml.completed, [paths[0], paths[1]])
  assert.equal(result.state.courses.ml.lastVisited?.path, paths[2])
  assert.deepEqual(result.state.courses.another, current.courses.another)
  assert.deepEqual(current.courses.ml.completed, [paths[0]])
  assert.equal(mergeProgress(result.state, incoming, { ml: new Set(paths) }).added, 0)
})

test('backup parsing rejects malformed/version-mismatched data without replacing current progress', () => {
  const valid = { version: 1 as const, courses: { ml: course([paths[0]], paths[1]) } }
  assert.deepEqual(parseProgress(JSON.parse(JSON.stringify(valid))), valid)
  for (const invalid of [null, [], {}, { version: 2, courses: {} }, { version: 1, courses: { ml: { completed: [4], lastVisited: null } } }, { version: 1, courses: { ml: { completed: [], lastVisited: { path: paths[0], at: 'bad' } } } }]) {
    assert.throws(() => parseProgress(invalid))
  }
  assert.deepEqual(emptyProgress(), { version: 1, courses: {} })
})
