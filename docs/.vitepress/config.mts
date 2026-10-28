import { defineConfig, type DefaultTheme } from 'vitepress'
import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
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
const faviconVersion = createHash('sha256')
  .update(readFileSync(new URL('../public/favicon.svg', import.meta.url)))
  .update(readFileSync(new URL('../public/favicon.ico', import.meta.url)))
  .digest('hex').slice(0, 12)

export default defineConfig({
  title: site.name,
  description: site.description,
  lang: 'en-US',
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ['link', { rel: 'icon', type: 'image/x-icon', sizes: '16x16 32x32 48x48', href: `/favicon.ico?v=${faviconVersion}` }],
    ['link', { rel: 'icon', type: 'image/svg+xml', sizes: 'any', href: `/favicon.svg?v=${faviconVersion}` }],
    ['meta', { name: 'theme-color', content: '#ffffff' }],
  ],
  ignoreDeadLinks: [(url) => localExamples.has(url)],
  markdown: { math: true, config: courseMarkdownPlugin(manifest) },
  themeConfig: {
    siteTitle: false,
    nav: [
      { text: 'Explore courses', link: '/#courses', activeMatch: '^/learn/' },
      { text: 'About', link: '/about' },
      { text: 'Community', link: site.communityUrl },
    ],
    sidebar: {
      '/course/': [
        { text: '← All courses', link: '/#courses' },
        { text: machineLearning.title, link: machineLearning.overview },
        ...courseItems,
      ],
    },
    search: { provider: 'local', options: { detailedView: true } },
    outline: { level: [2, 3] },
    socialLinks: [{ icon: 'github', link: site.organizationUrl }],
  },
})
