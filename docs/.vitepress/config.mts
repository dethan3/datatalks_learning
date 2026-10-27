import { defineConfig, type DefaultTheme } from 'vitepress'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { courseMarkdownPlugin } from '../../scripts/lib/course.ts'
import type { CourseManifest } from '../../src/types/course.ts'
import { site, machineLearning } from '../../src/config/courses.ts'

const manifestPath = fileURLToPath(new URL('../course-manifest.json', import.meta.url))
const manifest: CourseManifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {
  schemaVersion: 2, source: machineLearning.repository, sourceCommit: '', modules: [], pages: [], assets: [], diagnostics: [],
}
const courseItems: DefaultTheme.SidebarItem[] = manifest.modules.map((module) => ({
  text: module.title, link: module.route,
  collapsed: module.slug !== '01-intro',
  items: [...module.lessons, ...module.guides].map((page) => ({ text: page.title, link: page.route })),
}))
const localExamples = new Set(manifest.diagnostics.filter((item) => item.code === 'local-service-example').map((item) => item.href))

export default defineConfig({
  title: site.name,
  description: site.description,
  lang: 'en-US',
  cleanUrls: true,
  lastUpdated: true,
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }], ['meta', { name: 'theme-color', content: '#ffffff' }]],
  ignoreDeadLinks: [(url) => localExamples.has(url)],
  markdown: { math: true, config: courseMarkdownPlugin(manifest) },
  themeConfig: {
    logo: '/favicon.svg', siteTitle: site.name,
    nav: [
      { text: 'Explore courses', link: '/#courses', activeMatch: '^/learn/' },
      { text: 'About', link: '/about' },
      { text: 'Community', link: site.communityUrl },
    ],
    sidebar: {
      '/course/': [
        { text: '← All learning paths', link: '/#courses' },
        { text: machineLearning.title, link: machineLearning.overview },
        ...courseItems,
      ],
    },
    search: { provider: 'local', options: { detailedView: true } },
    outline: { level: [2, 3] },
    socialLinks: [{ icon: 'github', link: site.organizationUrl }],
  },
})
