<script setup lang="ts">
import { computed, watch } from 'vue'
import { useData, useRouter } from 'vitepress'
import DefaultTheme from 'vitepress/theme-without-fonts'
import { courseForPath } from '../../../src/config/courses.ts'
import { withBase } from 'vitepress'
import { youtubeVideoId, youtubeEmbedUrl, youtubeWatchUrl } from '../../../src/lib/youtube.ts'
import { useLearningProgress } from './composables/useLearningProgress.ts'
import ProgressMeter from './components/ProgressMeter.vue'

const { frontmatter, page } = useData()
const router = useRouter()
const progress = useLearningProgress()
const currentCourse = computed(() => courseForPath(page.value.relativePath))
const lessonPath = computed(() => page.value.relativePath.replace(/\.md$/, ''))
const isLesson = computed(() => frontmatter.value.reader?.kind === 'lesson')
const videoUrl = computed(() => typeof frontmatter.value.video_url === 'string' ? frontmatter.value.video_url : '')
const videoId = computed(() => youtubeVideoId(videoUrl.value))
const embedUrl = computed(() => videoId.value ? youtubeEmbedUrl(videoId.value) : '')
const watchUrl = computed(() => videoId.value ? youtubeWatchUrl(videoId.value) : videoUrl.value)
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
    <template #layout-top>
      <div v-if="progress.storageError.value" class="progress-storage-warning" role="status">
        <span>{{ progress.storageError.value }}</span><button @click="progress.exportBackup">Export session progress</button>
      </div>
    </template>
    <template #doc-before>
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
        <div v-if="videoId" class="lesson-video">
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
        <div v-if="videoId" class="video-actions">
          <a :href="watchUrl" target="_blank" rel="noreferrer">Watch on YouTube ↗</a>
        </div>
        <p v-else-if="videoUrl" class="video-fallback">
          <a :href="videoUrl" target="_blank" rel="noreferrer">Watch the official lecture on YouTube ↗</a>
        </p>
      </section>
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
