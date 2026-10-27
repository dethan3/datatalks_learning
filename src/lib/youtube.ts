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

export function youtubeEmbedUrl(id: string): string {
  if (!/^[\w-]{11}$/.test(id)) throw new Error('Invalid YouTube video ID')
  const url = new URL(`https://www.youtube.com/embed/${id}`)
  url.search = new URLSearchParams({ controls: '1', fs: '1', playsinline: '1', disablekb: '0' }).toString()
  return url.href
}

export function youtubeWatchUrl(id: string): string {
  if (!/^[\w-]{11}$/.test(id)) throw new Error('Invalid YouTube video ID')
  return `https://www.youtube.com/watch?v=${id}`
}
