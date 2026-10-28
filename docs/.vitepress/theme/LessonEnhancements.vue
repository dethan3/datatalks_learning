<script setup lang="ts">
import { computed, watch } from 'vue'
import { useData, useRouter } from 'vitepress'
import DefaultTheme from 'vitepress/theme-without-fonts'
import { courseForPath } from '../../../src/config/courses.ts'
import { withBase } from 'vitepress'
import { youtubeVideoId, youtubeEmbedUrl, youtubeWatchUrl } from '../../../src/lib/youtube.ts'
import { useLearningProgress } from './composables/useLearningProgress.ts'
import ProgressMeter from './components/ProgressMeter.vue'
import BrandWordmark from './components/BrandWordmark.vue'
import { useLessonFocus } from './composables/useLessonFocus.ts'
import LessonLayoutSwitch from './components/LessonLayoutSwitch.vue'

const { frontmatter, page } = useData()
const router = useRouter()
const progress = useLearningProgress()
const currentCourse = computed(() => courseForPath(page.value.relativePath))
const lessonPath = computed(() => page.value.relativePath.replace(/\.md$/, ''))
const isLesson = computed(() => frontmatter.value.reader?.kind === 'lesson')
const videoUrl = computed(() => typeof frontmatter.value.video_url === 'string' ? frontmatter.value.video_url : '')
const videoId = computed(() => youtubeVideoId(videoUrl.value))
const embedUrl = computed(() => videoId.value ? youtubeEmbedUrl(videoUrl.value) : '')
const watchUrl = computed(() => videoId.value ? youtubeWatchUrl(videoUrl.value) : videoUrl.value)
const focus = useLessonFocus(lessonPath, computed(() => isLesson.value && !!videoId.value))
const { playerSlot, trigger: focusTrigger, pageTop: focusPageTop } = focus
const isDone = computed(() => currentCourse.value ? progress.isComplete(currentCourse.value.id, lessonPath.value) : false)
const courseProgress = computed(() => currentCourse.value ? progress.summary(currentCourse.value.id) : null)

watch(() => [progress.ready.value, isLesson.value, lessonPath.value] as const, ([ready, lesson]) => {
  if (ready && lesson && currentCourse.value) progress.visit(currentCourse.value.id, lessonPath.value)
}, { immediate: true })
function toggleDone() {
  if (currentCourse.value) progress.setComplete(currentCourse.value.id, lessonPath.value, !isDone.value)
}
function completeAndContinue() {
  if (!currentCourse.value) return
  progress.setComplete(currentCourse.value.id, lessonPath.value, true)
  const summary = progress.summary(currentCourse.value.id)
  void router.go(withBase(summary.finished ? currentCourse.value.overview : summary.resume?.route ?? currentCourse.value.overview))
}
</script>

<template>
  <DefaultTheme.Layout>
    <template #nav-bar-title-before><BrandWordmark /></template>
    <template #layout-top>
      <div v-if="focus.active.value" class="lesson-focus-controls">
        <button class="focus-drawer-handle focus-drawer-handle--course" data-focus-drawer="course" :aria-expanded="focus.drawer.value === 'course'" aria-controls="VPSidebarNav" :aria-label="focus.drawer.value === 'course' ? 'Close course directory' : 'Open course directory'" title="Course directory" @click="focus.toggleDrawer('course')">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16m4-11h4m-4 6h4"/></svg>
        </button>
        <button class="focus-drawer-handle focus-drawer-handle--outline" data-focus-drawer="outline" :aria-expanded="focus.drawer.value === 'outline'" :aria-label="focus.drawer.value === 'outline' ? 'Close page outline' : 'Open page outline'" title="On this page" @click="focus.toggleDrawer('outline')">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M15 4v16M7 9h4m-4 6h4"/></svg>
        </button>
        <button v-if="focus.drawer.value" class="focus-drawer-backdrop" tabindex="-1" aria-label="Close directory" @click="focus.closeDrawer()"></button>
      </div>
      <div v-if="progress.storageError.value" class="progress-storage-warning" role="status">
        <span>{{ progress.storageError.value }}</span><button @click="progress.exportBackup">Export session progress</button>
      </div>
    </template>
    <template #sidebar-nav-before>
      <div v-if="focus.drawer.value === 'course'" class="focus-drawer-heading"><span>Course directory</span><button aria-label="Close course directory" @click="focus.closeDrawer()">×</button></div>
      <div v-if="focus.available.value" class="sidebar-layout-preference">
        <span>READING LAYOUT</span>
        <LessonLayoutSwitch :pinned="focus.pinned.value" @change="focus.setLayout" />
      </div>
    </template>
    <template #aside-top>
      <div v-if="focus.drawer.value === 'outline'" class="focus-drawer-heading"><span>On this page</span><button aria-label="Close page outline" @click="focus.closeDrawer()">×</button></div>
    </template>
    <template #doc-before>
      <div v-if="isLesson" ref="focusPageTop" class="focus-sentinel" aria-hidden="true"></div>
      <a v-if="currentCourse" class="reader-back" :href="withBase(currentCourse.overview)">← {{ currentCourse.title }}</a>
      <section v-if="isLesson" class="lesson-tools">
        <div class="lesson-tools__meta">
          <span class="lesson-kicker">{{ currentCourse?.shortTitle }} · {{ frontmatter.reader?.moduleSlug }}</span>
          <button class="completion-button" :class="{ 'is-done': isDone }" :aria-pressed="isDone" :disabled="!progress.ready.value" :title="isDone ? 'Mark this lesson as unfinished' : 'Mark this lesson as complete'" @click="toggleDone">
            <span aria-hidden="true">{{ isDone ? '✓' : '○' }}</span>
            {{ isDone ? 'Completed' : 'Mark as complete' }}
          </button>
        </div>
        <div v-if="progress.ready.value && courseProgress" class="lesson-progress">
          <ProgressMeter :completed="courseProgress.completed" :total="courseProgress.total" />
          <a v-if="currentCourse" :href="withBase(currentCourse.overview)">View learning progress →</a>
        </div>
        <div v-if="videoId" ref="playerSlot" class="lesson-player-slot" :style="focus.active.value && focus.reservedHeight.value ? { height: `${focus.reservedHeight.value}px` } : undefined">
          <div class="lesson-player">
            <div class="lesson-video">
              <iframe
                :key="embedUrl"
                :src="embedUrl"
                :title="`Official ${currentCourse?.title ?? 'course'} lecture`"
                loading="lazy"
                referrerpolicy="strict-origin-when-cross-origin"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowfullscreen
              />
            </div>
            <div class="video-actions">
              <a :href="watchUrl" target="_blank" rel="noreferrer">Watch on YouTube ↗</a>
              <LessonLayoutSwitch v-if="focus.available.value" :pinned="focus.pinned.value" @change="focus.setLayout" />
            </div>
          </div>
        </div>
        <p v-else-if="videoUrl" class="video-fallback">
          <a :href="videoUrl" target="_blank" rel="noreferrer">Watch the official lecture on YouTube ↗</a>
        </p>
      </section>
      <div v-if="isLesson && videoId" ref="focusTrigger" class="focus-sentinel" aria-hidden="true"></div>
    </template>
    <template #doc-after>
      <section v-if="isLesson" class="lesson-footer-note">
        <p>Study tip: explain the main idea in your own words before moving to the next lesson.</p>
        <div class="lesson-finish-actions">
          <button class="completion-button" :class="{ 'is-done': isDone }" :disabled="!progress.ready.value" @click="completeAndContinue">{{ courseProgress?.finished ? 'Review course progress' : isDone ? 'Continue learning →' : 'Complete & continue →' }}</button>
          <span v-if="isDone" class="lesson-completed-status" role="status">✓ Lesson completed</span>
        </div>
        <a :href="frontmatter.reader?.sourceUrl" target="_blank" rel="noreferrer">View source materials on GitHub ↗</a>
      </section>
    </template>
  </DefaultTheme.Layout>
</template>
