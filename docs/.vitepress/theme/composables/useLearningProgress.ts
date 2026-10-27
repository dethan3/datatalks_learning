import { computed, onMounted, onUnmounted, readonly, ref, shallowRef } from 'vue'
import { data } from '../../data/catalog.data.ts'
import { emptyCourseProgress, emptyProgress, legacyProgressKey, lessonPath, mergeProgress, parseProgress, progressStorageKey, migrateLegacyProgress, summarizeProgress, type LearningProgress } from '../../../../src/lib/progress.ts'

const state = shallowRef<LearningProgress>(emptyProgress())
const ready = ref(false)
const storageError = ref('')
let consumers = 0
let canWrite = true
const lessonsFor = (id: string) => data.entries.find((entry) => entry.course.id === id)?.modules.flatMap((module) => module.lessons) ?? []
const catalog = () => Object.fromEntries(data.entries.filter((entry) => entry.course.mode === 'local').map((entry) => [entry.course.id, new Set(lessonsFor(entry.course.id).map((lesson) => lessonPath(lesson.route)))]))

function load() {
  try {
    const saved = localStorage.getItem(progressStorageKey)
    const legacy = saved === null ? localStorage.getItem(legacyProgressKey) : null
    state.value = saved !== null ? parseProgress(JSON.parse(saved)) : legacy !== null ? migrateLegacyProgress(JSON.parse(legacy)) : emptyProgress()
    canWrite = true
    storageError.value = ''
  } catch {
    canWrite = false
    storageError.value = 'Saved progress could not be read. Changes are kept for this session only. Export a backup before leaving; your existing saved data has not been overwritten.'
  }
}

function save(next: LearningProgress) {
  state.value = next
  if (!canWrite) return
  try {
    localStorage.setItem(progressStorageKey, JSON.stringify(next))
    storageError.value = ''
  } catch {
    storageError.value = 'Your browser could not save progress. Changes are kept for this session only. Export a backup before leaving.'
  }
}

function sync(event: StorageEvent) {
  if (event.key !== progressStorageKey && event.key !== null) return
  try { if (event.storageArea !== window.localStorage) return } catch { return }
  if (storageError.value) return // Preserve unsaved work in this tab until it can be backed up.
  load()
}

// Re-read before a mutation so a recently changed tab is not overwritten by stale state.
function latest() { if (!storageError.value) load(); return state.value }

export function useLearningProgress() {
  onMounted(() => {
    if (consumers++ === 0) {
      load()
      ready.value = true
      window.addEventListener('storage', sync)
    }
  })
  onUnmounted(() => { if (--consumers === 0) window.removeEventListener('storage', sync) })

  function summary(id: string) { return summarizeProgress(lessonsFor(id), state.value.courses[id]) }
  function isComplete(id: string, path: string) { return state.value.courses[id]?.completed.includes(lessonPath(path)) ?? false }
  function updateLesson(id: string, path: string, completed?: boolean) {
    const normalized = lessonPath(path)
    if (!catalog()[id]?.has(normalized)) return
    const current = latest()
    const course = current.courses[id] ?? emptyCourseProgress()
    const next = completed === undefined
      ? { ...course, lastVisited: { path: normalized, at: new Date().toISOString() } }
      : { ...course, completed: completed ? [...new Set([...course.completed, normalized])] : course.completed.filter((item) => item !== normalized) }
    save({ version: 1, courses: { ...current.courses, [id]: next } })
  }
  function exportBackup() {
    const blob = new Blob([JSON.stringify(state.value, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `datatalks-progress-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  async function importBackup(file: File) {
    if (file.size > 512 * 1024) throw new Error('This file is too large for a progress backup (maximum 512 KB).')
    const incoming = parseProgress(JSON.parse(await file.text()))
    const result = mergeProgress(latest(), incoming, catalog())
    // An explicit import can recover corrupt stored data. Existing completions are merged.
    canWrite = true
    save(result.state)
    return result
  }
  const activeCourse = computed(() => data.entries.filter((entry) => entry.course.mode === 'local' && summary(entry.course.id).started)
    .sort((a, b) => Date.parse(state.value.courses[b.course.id]?.lastVisited?.at ?? '1970-01-01') - Date.parse(state.value.courses[a.course.id]?.lastVisited?.at ?? '1970-01-01'))[0] ?? null)
  return { ready: readonly(ready), storageError: readonly(storageError), summary, isComplete, activeCourse,
    visit: (id: string, path: string) => updateLesson(id, path),
    setComplete: (id: string, path: string, completed: boolean) => updateLesson(id, path, completed), exportBackup, importBackup }
}
