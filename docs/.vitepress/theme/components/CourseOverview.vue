<script setup lang="ts">
import { computed } from 'vue'
import { withBase } from 'vitepress'
import { data } from '../../data/catalog.data.ts'
import { machineLearning } from '../../../../src/config/courses.ts'
import CourseArtwork from './CourseArtwork.vue'
import ProgressMeter from './ProgressMeter.vue'
import ProgressBackup from './ProgressBackup.vue'
import { useLearningProgress } from '../composables/useLearningProgress.ts'
const progress = useLearningProgress()
const entry = computed(() => data.entries.find((entry) => entry.course.id === machineLearning.id))
const summary = computed(() => progress.summary(machineLearning.id))
const startRoute = computed(() => summary.value.resume?.route ?? machineLearning.start)
const startLabel = computed(() => summary.value.finished ? 'Review your learning' : summary.value.started ? 'Continue learning' : 'Start with the first lesson')
const modules = computed(() => entry.value?.modules.map((module) => ({ ...module,
  completed: module.lessons.filter((lesson) => progress.isComplete(machineLearning.id, lesson.route)).length,
})) ?? [])
</script>

<template>
  <div class="course-overview">
    <a class="back-link" :href="withBase('/#courses')">← All courses</a>
    <section class="course-intro tone-lavender"><div><div class="eyebrow">COURSE / MACHINE LEARNING</div><h1>Machine Learning<br><span>Zoomcamp.</span></h1><p>{{ machineLearning.description }}</p><div class="overview-stats" v-if="entry?.stats"><span>{{ entry.stats.modules }} modules</span><span>{{ entry.stats.lessons }} lessons</span><span>{{ entry.stats.guides }} extra guides</span></div><div class="hero-actions"><a class="button button-primary" :href="withBase(startRoute)">{{ startLabel }} <span>→</span></a><a class="hero-secondary" :href="machineLearning.repository" target="_blank" rel="noreferrer">Official repository ↗</a></div></div><CourseArtwork kind="machine-learning" /></section>
    <section class="course-progress-panel" aria-labelledby="your-progress-heading">
      <div class="eyebrow">YOUR PROGRESS</div>
      <h2 id="your-progress-heading">{{ summary.finished ? 'Every lesson, completed.' : summary.started ? 'Keep your curiosity going.' : 'Your next small step starts here.' }}</h2>
      <template v-if="progress.ready.value">
        <ProgressMeter :completed="summary.completed" :total="summary.total" />
        <p v-if="summary.lastLesson" class="last-lesson">Last opened: <a :href="withBase(summary.lastLesson.route)">{{ summary.lastLesson.title }}</a></p>
        <p v-if="summary.resume && !summary.finished" class="next-lesson">{{ summary.started ? 'Continue with' : 'First lesson' }}: <a :href="withBase(summary.resume.route)">{{ summary.resume.title }} →</a></p>
        <p class="progress-explanation">Mark lessons complete as you finish them. Guides and project instructions are separate from the lesson count.</p>
      </template>
      <ProgressBackup />
    </section>
    <section class="module-collection">
      <div class="section-heading"><div><div class="eyebrow">THE LEARNING MAP</div><h2>One module at a time.</h2></div><p>Read the module introduction for official<br>updates, workshops, and prerequisites.</p></div>
      <div class="module-list">
        <div v-for="module in modules" :key="module.slug" class="module-with-progress">
          <a class="module-row" :href="withBase(module.route)"><span class="module-number">{{ module.kind === 'projects' ? '↳' : module.slug.split('-')[0] }}</span><div><h3>{{ module.title.replace(/^\d+\.\s*/, '') }}</h3><p>{{ module.lessons.length ? `${module.lessons.length} lessons` : 'Project instructions' }}<template v-if="module.guides.length"> · {{ module.guides.length }} {{ module.guides.length === 1 ? 'guide' : 'guides' }}</template><template v-if="!module.inSyllabus"> · Optional, older material</template></p></div><span class="module-arrow" aria-hidden="true">↗</span></a>
          <div v-if="module.lessons.length" class="module-learning-details">
            <ProgressMeter v-if="progress.ready.value" :completed="module.completed" :total="module.lessons.length" :label="`${module.title} progress`" />
            <details class="module-lessons">
              <summary>View {{ module.lessons.length }} lessons</summary>
              <ul>
                <li v-for="lesson in module.lessons" :key="lesson.route">
                  <a :href="withBase(lesson.route)" :class="{ 'is-complete': progress.isComplete(machineLearning.id, lesson.route) }">
                    <span aria-hidden="true">{{ progress.isComplete(machineLearning.id, lesson.route) ? '✓' : '○' }}</span><span>{{ lesson.title }}</span>
                    <small>{{ progress.isComplete(machineLearning.id, lesson.route) ? 'Completed' : summary.lastLesson?.route === lesson.route ? 'In progress' : 'Not completed' }}</small>
                  </a>
                </li>
              </ul>
            </details>
          </div>
        </div>
      </div>
    </section>
    <p class="overview-footnote">Imported from the official repository. Original notices about older materials are preserved. Videos, notebooks, and datasets remain attributed to their authors.</p>
  </div>
</template>
