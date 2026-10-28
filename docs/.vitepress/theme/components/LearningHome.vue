<script setup lang="ts">
import { computed, ref } from 'vue'
import { withBase } from 'vitepress'
import { data } from '../../data/catalog.data.ts'
import { site } from '../../../../src/config/courses.ts'
import CourseArtwork from './CourseArtwork.vue'
import BrandWordmark from './BrandWordmark.vue'
import ProgressMeter from './ProgressMeter.vue'
import { useLearningProgress } from '../composables/useLearningProgress.ts'

const filter = ref('all')
const filters = [{ id: 'all', label: 'All courses' }, { id: 'local', label: 'Read here' }, { id: 'external', label: 'Official resources' }]
const visible = computed(() => data.entries.filter((entry) => filter.value === 'all' || entry.course.mode === filter.value))
const localCourse = computed(() => data.entries.find((entry) => entry.course.mode === 'local'))
const progress = useLearningProgress()
const active = computed(() => progress.activeCourse.value)
const activeSummary = computed(() => active.value ? progress.summary(active.value.course.id) : null)
</script>

<template>
  <div class="learning-home">
    <section class="home-hero" aria-labelledby="hero-heading">
      <div class="hero-copy">
        <div class="eyebrow"><span class="tiny-mark">◈</span> A HOME FOR CURIOUS MINDS</div>
        <h1 id="hero-heading">Follow your<br><span class="curiosity">curiosity<svg viewBox="0 0 460 30" aria-hidden="true"><path d="M5 16C120 2 318 3 450 17M28 24c104-10 271-8 388-1" /></svg></span><span class="hero-period">.</span></h1>
        <p class="hero-description">Data, machine learning, and AI.<br>Find a course, follow an idea, and build something of your own.</p>
        <div class="hero-actions"><a class="button button-primary" href="#courses">Explore the courses <span aria-hidden="true">↗</span></a><a class="hero-secondary" :href="site.officialUrl" target="_blank" rel="noreferrer">Meet DataTalks.Club <span aria-hidden="true">↗</span></a></div>
        <div class="hero-note"><span class="note-line"></span> Open courses. Your pace. Plenty to explore.</div>
      </div>
      <div class="hero-board" aria-hidden="true">
        <div class="orbit-caption">a little learning, every day</div>
        <div class="board-path"></div>
        <div class="board-card board-card-data"><span class="board-card-label">01 / THE FOUNDATIONS</span><span class="board-card-title">Think in<br>data.</span><span class="board-mini-grid"><i></i><i></i><i></i><i></i><i></i><i></i></span><span class="board-card-bottom">stay curious <span>↗</span></span></div>
        <div class="board-card board-card-build"><span class="board-card-label">02 / THE POSSIBILITIES</span><span class="board-card-title">Make it<br>happen.</span><div class="mini-chart"><i></i><i></i><i></i><i></i><i></i></div><span class="board-card-bottom">learn by building <span>↗</span></span></div>
        <svg class="board-orbit" viewBox="0 0 96 96" fill="none"><ellipse cx="48" cy="48" rx="41" ry="17" stroke="currentColor" stroke-width="2.5" transform="rotate(-35 48 48)"/><ellipse cx="48" cy="48" rx="41" ry="17" stroke="currentColor" stroke-width="2.5" transform="rotate(35 48 48)"/><circle cx="48" cy="48" r="7" fill="currentColor"/><circle cx="79" cy="24" r="5" fill="#aaa5e2"/></svg><span class="board-sticker">small steps,<br><strong>big ideas.</strong></span><span class="board-dot dot-blue"></span><span class="board-dot dot-lavender"></span>
      </div>
    </section>
    <div class="topic-ribbon" aria-label="Learning topics"><span>DATA ENGINEERING</span><i>◈</i><span>MACHINE LEARNING</span><i>◈</i><span>MLOPS</span><i>◈</i><span>LLM ENGINEERING</span><i>◈</i><span>YOUR NEXT PROJECT</span></div>
    <section v-if="progress.ready.value && active && activeSummary?.resume" class="resume-learning" aria-labelledby="resume-heading">
      <div><div class="eyebrow">{{ activeSummary.finished ? 'YOUR LEARNING' : 'PICK UP WHERE YOU LEFT OFF' }}</div><h2 id="resume-heading">{{ active.course.title }}</h2><p>{{ activeSummary.finished ? 'All lessons completed. Revisit an idea whenever you like.' : activeSummary.resume.title }}</p><ProgressMeter :completed="activeSummary.completed" :total="activeSummary.total" /></div>
      <a class="button button-primary" :href="withBase(activeSummary.finished && active.course.mode === 'local' ? active.course.overview : activeSummary.resume.route)">{{ activeSummary.finished ? 'Review progress' : 'Continue learning' }} <span aria-hidden="true">→</span></a>
    </section>
    <section id="courses" class="course-catalog" aria-labelledby="courses-heading">
      <div class="section-heading"><div><div class="eyebrow">THE COURSE COLLECTION</div><h2 id="courses-heading">What sparks your interest<span class="accent-dot">?</span></h2></div><p>A few directions to explore.<br>Pick the one that feels like you.</p></div>
      <div class="catalog-toolbar"><div class="course-filters" role="group" aria-label="Filter courses"><button v-for="item in filters" :key="item.id" :aria-pressed="filter === item.id" :class="{ selected: filter === item.id }" @click="filter = item.id">{{ item.label }}<span v-if="item.id === 'all'" class="filter-count">{{ data.entries.length }}</span></button></div><span class="catalog-count" aria-live="polite">{{ visible.length }} {{ visible.length === 1 ? 'course' : 'courses' }} to explore</span></div>
      <div class="course-grid">
        <article v-for="(entry, index) in visible" :key="entry.course.id" class="course-card" :class="`tone-${entry.course.tone}`" :style="{ '--card-order': index }">
          <div class="course-card-main"><div class="course-category">{{ entry.course.category }}</div><h3><a :href="entry.course.mode === 'local' ? withBase(entry.course.overview) : entry.course.repository" :target="entry.course.mode === 'external' ? '_blank' : undefined" :rel="entry.course.mode === 'external' ? 'noreferrer' : undefined">{{ entry.course.title }}</a></h3><p>{{ entry.course.description }}</p><div class="course-tags"><span v-for="tag in entry.course.tags" :key="tag">{{ tag }}</span></div></div>
          <CourseArtwork :kind="entry.course.id" />
          <div class="course-card-footer"><span v-if="entry.stats" class="availability"><i></i>{{ entry.stats.modules }} modules · {{ entry.stats.lessons }} lessons</span><span v-else class="resource-label">Official resources · External</span><a class="course-open" :href="entry.course.mode === 'local' ? withBase(entry.course.overview) : entry.course.repository" :target="entry.course.mode === 'external' ? '_blank' : undefined" :rel="entry.course.mode === 'external' ? 'noreferrer' : undefined">{{ entry.course.mode === 'local' ? 'Start exploring' : 'View course' }}<span aria-hidden="true">{{ entry.course.mode === 'local' ? '→' : '↗' }}</span></a></div>
          <ProgressMeter v-if="progress.ready.value && entry.course.mode === 'local' && entry.stats" class="course-card-progress" :completed="progress.summary(entry.course.id).completed" :total="progress.summary(entry.course.id).total" :label="`${entry.course.title} progress`" />
        </article>
      </div>
      <p v-if="filter === 'external'" class="catalog-explanation">These courses open their official repositories. On-site reading is not available for them yet; you can start learning with the official materials.</p>
    </section>
    <section class="start-note"><div class="start-note-symbol" aria-hidden="true">↳</div><div><div class="eyebrow">ONE CHAPTER IS A GOOD START</div><h2>You don't need the whole plan.</h2><p>Pick one lesson. Watch, read, try it out. The next step will be there when you're ready.</p></div><a v-if="localCourse?.course.mode === 'local'" class="button button-ink" :href="withBase(localCourse.course.start)">Take the first step <span aria-hidden="true">→</span></a></section>
    <footer class="home-footer">
      <a class="footer-wordmark" :href="withBase('/')"><BrandWordmark /></a>
      <p>Made for the joy of figuring things out.</p>
      <nav class="footer-links" aria-label="Project links">
        <a :href="site.repositoryUrl" target="_blank" rel="noreferrer">Source on GitHub ↗</a>
        <a :href="site.issuesUrl" target="_blank" rel="noreferrer">Report an issue ↗</a>
      </nav>
    </footer>
  </div>
</template>
