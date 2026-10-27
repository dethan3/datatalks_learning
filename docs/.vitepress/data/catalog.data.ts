import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineLoader } from 'vitepress'
import { courses, type LearningCourse } from '../../../src/config/courses.ts'
import type { CourseManifest, CourseModule } from '../../../src/types/course.ts'

export interface CatalogEntry {
  course: LearningCourse
  stats: { modules: number; lessons: number; guides: number } | null
  modules: CourseModule[]
  sourceCommit: string | null
}
export interface CatalogData { entries: CatalogEntry[] }
export declare const data: CatalogData
const manifestFiles = courses.flatMap((course) => course.mode === 'local' ? [fileURLToPath(new URL(`../../${course.manifest}`, import.meta.url))] : [])
export default defineLoader({
  watch: manifestFiles,
  load(): CatalogData {
    return {
      entries: courses.map((course) => {
        if (course.mode === 'external') return { course, stats: null, modules: [], sourceCommit: null }
        const file = fileURLToPath(new URL(`../../${course.manifest}`, import.meta.url))
        const manifest: CourseManifest | null = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null
        return {
          course,
          stats: manifest ? {
            modules: manifest.modules.filter((module) => module.kind === 'module').length,
            lessons: manifest.pages.filter((page) => page.kind === 'lesson').length,
            guides: manifest.pages.filter((page) => page.kind === 'guide').length,
          } : null,
          modules: manifest?.modules ?? [], sourceCommit: manifest?.sourceCommit ?? null,
        }
      }),
    }
  },
})
