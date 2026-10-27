import type { ChapterEntry } from '../types/course.ts'

export const progressStorageKey = 'datatalks-learning:progress:v1'
export const legacyProgressKey = 'ml-zoomcamp-reader:completed:v1'
export interface CourseProgress {
  completed: string[]
  lastVisited: { path: string; at: string } | null
}
export interface LearningProgress { version: 1; courses: Record<string, CourseProgress> }
export const emptyProgress = (): LearningProgress => ({ version: 1, courses: {} })
export const emptyCourseProgress = (): CourseProgress => ({ completed: [], lastVisited: null })

export function lessonPath(value: string): string {
  const path = `/${value.replace(/^\/+/, '').replace(/\.(md|html)$/, '').replace(/\/$/, '')}`
  if (!/^\/[\w-]+(?:\/[\w.-]+)+$/.test(path) || path.split('/').some((part) => part === '.' || part === '..')) {
    throw new Error('Invalid lesson path in progress data.')
  }
  return path
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseProgress(value: unknown): LearningProgress {
  if (!record(value) || value.version !== 1 || !record(value.courses)) throw new Error('Unsupported progress file. Use a DataTalks Learning progress backup (version 1).')
  const state = emptyProgress()
  for (const [id, course] of Object.entries(value.courses)) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || !record(course) || !Array.isArray(course.completed) || !course.completed.every((item) => typeof item === 'string')) {
      throw new Error('Invalid course progress in backup.')
    }
    let lastVisited: CourseProgress['lastVisited'] = null
    if (course.lastVisited !== null) {
      if (!record(course.lastVisited) || typeof course.lastVisited.path !== 'string' || typeof course.lastVisited.at !== 'string' || !Number.isFinite(Date.parse(course.lastVisited.at))) {
        throw new Error('Invalid last lesson in progress data.')
      }
      lastVisited = { path: lessonPath(course.lastVisited.path), at: course.lastVisited.at }
    }
    state.courses[id] = { completed: [...new Set(course.completed.map((path) => lessonPath(path as string)))], lastVisited }
  }
  return state
}

export function migrateLegacyProgress(value: unknown): LearningProgress {
  if (!Array.isArray(value)) throw new Error('Invalid saved lesson completion data.')
  const completed = value.filter((item): item is string => typeof item === 'string' && /^\/?course\//.test(item)).flatMap((path) => {
    try { return [lessonPath(path)] } catch { return [] }
  })
  return { version: 1, courses: { 'machine-learning': { completed: [...new Set(completed)], lastVisited: null } } }
}

export function summarizeProgress(lessons: readonly ChapterEntry[], progress: CourseProgress = emptyCourseProgress()) {
  const unique = [...new Map(lessons.map((lesson) => [lessonPath(lesson.route), lesson])).values()]
  const completed = new Set(progress.completed)
  const count = unique.filter((lesson) => completed.has(lessonPath(lesson.route))).length
  const lastIndex = unique.findIndex((lesson) => lessonPath(lesson.route) === progress.lastVisited?.path)
  const lastLesson = unique[lastIndex] ?? null
  // Resume an unfinished last visit; otherwise move forward, wrapping to earlier gaps.
  const ordered = lastIndex < 0 ? unique : [...unique.slice(lastIndex), ...unique.slice(0, lastIndex)]
  const resume = ordered.find((lesson) => !completed.has(lessonPath(lesson.route))) ?? lastLesson ?? unique[0] ?? null
  return { completed: count, total: unique.length, percent: unique.length ? Math.floor(count / unique.length * 100) : 0,
    finished: unique.length > 0 && count === unique.length, started: count > 0 || lastLesson !== null, lastLesson, resume }
}

/** Merge backups, never clear existing completions; ignore stale/unconfigured lessons explicitly. */
export function mergeProgress(current: LearningProgress, incoming: LearningProgress, catalog: Record<string, ReadonlySet<string>>) {
  const merged: LearningProgress = { version: 1, courses: { ...current.courses } }
  let added = 0
  let ignored = 0
  for (const [id, course] of Object.entries(incoming.courses)) {
    const known = Object.hasOwn(catalog, id) ? catalog[id] : undefined
    const existing = current.courses[id] ?? emptyCourseProgress()
    const completed = new Set(existing.completed)
    for (const path of course.completed) {
      if (!known?.has(path)) { ignored++; continue }
      if (!completed.has(path)) { completed.add(path); added++ }
    }
    let lastVisited = existing.lastVisited
    if (course.lastVisited) {
      if (!known?.has(course.lastVisited.path)) ignored++
      else if (!lastVisited || Date.parse(course.lastVisited.at) > Date.parse(lastVisited.at)) lastVisited = course.lastVisited
    }
    if (known) merged.courses[id] = { completed: [...completed], lastVisited }
  }
  return { state: merged, added, ignored }
}
