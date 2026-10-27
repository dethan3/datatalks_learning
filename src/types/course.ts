export type PageKind = 'overview' | 'module' | 'lesson' | 'guide'
export type ReferenceType = 'link' | 'image' | 'resource'
export interface Reference { type: ReferenceType; href: string; label?: string }
export type ResourceKind = 'notebook' | 'data-or-model' | 'asset' | 'code-or-support' | 'page' | 'directory'
export interface RepositoryReference extends Reference {
  url: string
  repoPath: string
  suffix: string
  correction?: string
  status: 'local' | 'upstream-missing' | 'upstream-resource' | 'upstream-anchor-fallback'
  kind: ResourceKind
}
export interface ExternalReference extends Reference {
  url: string
  status: 'external' | 'unsupported-url'
  kind: 'external'
}
export type ResolvedReference = RepositoryReference | ExternalReference
export interface NavigationTarget { sourcePath: string; route: string; title: string; via: 'metadata' | 'module-order' }
export interface Navigation { previous?: NavigationTarget | null; next?: NavigationTarget | null }
export interface SourceMetadata extends Record<string, unknown> {
  title?: string
  video_url?: string
  prev_url?: string
  next_url?: string
  code?: { label?: string; path: string }[]
}
export interface CoursePage {
  sourcePath: string
  route: string
  title: string
  kind: PageKind
  moduleSlug: string | null
  indexedBy: string
  sourceUrl: string
  sourceHash: string
  generatedHash: string
  video_url: string | null
  videoOrigin: 'frontmatter' | 'body' | null
  prev_url: string | null
  next_url: string | null
  links: ResolvedReference[]
  navigation: Navigation
}
export interface SourcePage extends Omit<CoursePage, 'generatedHash'> {
  body: string
  metadata: SourceMetadata
  references: Reference[]
}
export interface ChapterEntry { sourcePath: string; title: string; route: string; indexedBy: string }
export interface CourseModule {
  slug: string
  title: string
  route: string
  inSyllabus: boolean
  kind: 'module' | 'projects'
  lessons: ChapterEntry[]
  guides: ChapterEntry[]
  expected: { sourcePath: string; indexedBy: string }[]
}
export interface Diagnostic {
  level: 'warning' | 'error'
  code: string
  sourcePath: string
  message: string
  href?: string
  target?: string
  type?: ReferenceType
  anchor?: string
}
export interface CourseManifest {
  schemaVersion: number
  source: string
  sourceBranch?: string
  sourceCommit: string
  generatedAt?: string
  modules: CourseModule[]
  pages: CoursePage[]
  assets: { sourcePath: string; hash: string }[]
  diagnostics: Diagnostic[]
}
export interface SourceSnapshot { commit: string; inventory: string[]; source?: string; ref?: string }
export interface MarkdownCatalog { pages: { sourcePath: string; links: Pick<ResolvedReference, 'type' | 'href' | 'url'>[] }[] }
export interface DocumentNode {
  nodeName: string
  tagName?: string
  attrs?: { name: string; value: string }[]
  value?: string
  childNodes?: DocumentNode[]
  content?: DocumentNode
  sourceCodeLocation?: { startOffset: number; endOffset: number; attrs?: Record<string, { startOffset: number; endOffset: number }> } | null
}
export interface HtmlReference extends Reference {
  node: DocumentNode
  attr: { name: string; value: string }
  srcset?: boolean
}
export interface HtmlOutput { html: string; ids: Set<string>; markdown?: string }
