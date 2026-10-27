declare module 'markdown-it-mathjax3' {
  import type { PluginWithOptions } from 'markdown-it'
  const plugin: PluginWithOptions<Record<string, unknown>>
  export default plugin
}
