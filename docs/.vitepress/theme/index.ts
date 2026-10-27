import DefaultTheme from 'vitepress/theme-without-fonts'
import type { Theme } from 'vitepress'
import '@fontsource-variable/dm-sans'
import '@fontsource-variable/outfit'
import './custom.css'
import LessonEnhancements from './LessonEnhancements.vue'
import LearningHome from './components/LearningHome.vue'
import CourseOverview from './components/CourseOverview.vue'

export default {
  extends: DefaultTheme,
  Layout: LessonEnhancements,
  enhanceApp({ app }) {
    app.component('LearningHome', LearningHome)
    app.component('CourseOverview', CourseOverview)
  },
} satisfies Theme
