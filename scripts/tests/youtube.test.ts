import test from 'node:test'
import assert from 'node:assert/strict'
import { youtubeEmbedUrl, youtubeVideoId, youtubeWatchUrl } from '../../src/lib/youtube.ts'

test('standard YouTube embed keeps native controls, fullscreen and keyboard shortcuts', () => {
  const id = 'Crm_5n4mvmg'
  const url = new URL(youtubeEmbedUrl(id))
  assert.equal(url.hostname, 'www.youtube.com')
  assert.equal(url.pathname, `/embed/${id}`)
  assert.equal(url.searchParams.get('controls'), '1')
  assert.equal(url.searchParams.get('fs'), '1')
  assert.equal(url.searchParams.get('playsinline'), '1')
  assert.equal(url.searchParams.get('disablekb'), '0')
  assert.equal(youtubeVideoId(url.href), id)
  assert.equal(url.searchParams.has('autoplay'), false)
  assert.equal(youtubeWatchUrl(id), `https://www.youtube.com/watch?v=${id}`)
  assert.throws(() => youtubeEmbedUrl('javascript:bad'))
  assert.throws(() => youtubeWatchUrl('../invalid'))
})
