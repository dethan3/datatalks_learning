export function youtubeVideoId(source: string): string | null {
  try {
    const url = new URL(source)
    if (!['https:', 'http:'].includes(url.protocol)) return null
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    let id: string | null | undefined
    if (host === 'youtu.be') id = url.pathname.split('/')[1]
    else if (['youtube.com', 'm.youtube.com', 'youtube-nocookie.com'].includes(host)) {
      id = url.pathname === '/watch' ? url.searchParams.get('v') : /^\/(embed|shorts|live)\//.test(url.pathname) ? url.pathname.split('/')[2] : null
    }
    return /^[\w-]{11}$/.test(id ?? '') ? id! : null
  } catch { return null }
}

function youtubeSource(source: string): { id: string; url: URL | null } {
  if (/^[\w-]{11}$/.test(source)) return { id: source, url: null }
  const id = youtubeVideoId(source)
  if (!id) throw new Error('Invalid YouTube video URL or ID')
  return { id, url: new URL(source) }
}

function startSeconds(url: URL): number | null {
  const value = url.searchParams.get('start') ?? url.searchParams.get('t')
    ?? url.searchParams.get('time_continue') ?? new URLSearchParams(url.hash.slice(1)).get('t')
  if (!value) return null
  const duration = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value)
  const seconds = /^\d+$/.test(value) ? Number(value)
    : duration ? Number(duration[1] ?? 0) * 3600 + Number(duration[2] ?? 0) * 60 + Number(duration[3] ?? 0) : NaN
  return Number.isSafeInteger(seconds) && seconds >= 0 ? seconds : null
}

export function youtubeEmbedUrl(source: string): string {
  const { id, url: original } = youtubeSource(source)
  const url = new URL(`https://www.youtube.com/embed/${id}`)
  url.search = new URLSearchParams({ controls: '1', fs: '1', playsinline: '1', disablekb: '0' }).toString()
  if (original) {
    const list = original.searchParams.get('list')
    if (list) {
      url.searchParams.set('listType', 'playlist')
      url.searchParams.set('list', list)
    }
    const start = startSeconds(original)
    if (start !== null) url.searchParams.set('start', String(start))
  }
  return url.href
}

export function youtubeWatchUrl(source: string): string {
  const { id, url } = youtubeSource(source)
  return url?.href ?? `https://www.youtube.com/watch?v=${id}`
}
