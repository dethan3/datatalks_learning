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

test('official lesson links retain their playlist and position when opened on YouTube', () => {
  const source = 'https://www.youtube.com/watch?v=Crm_5n4mvmg&list=PL3MmuxUbc_hIhxl5Ji8t4O6lPAOpHaCLR&index=2'
  assert.equal(youtubeWatchUrl(source), source)
  const embed = new URL(youtubeEmbedUrl(source))
  assert.equal(embed.pathname, '/embed/Crm_5n4mvmg')
  assert.equal(embed.searchParams.get('list'), 'PL3MmuxUbc_hIhxl5Ji8t4O6lPAOpHaCLR')
  assert.equal(embed.searchParams.get('listType'), 'playlist')
  // The embedded video ID selects this lesson; watch-page indices are not player parameters.
  assert.equal(embed.searchParams.has('index'), false)
})

test('source timestamps become embed start times without forwarding playback or referral overrides', () => {
  for (const [time, seconds] of [['90', '90'], ['90s', '90'], ['1m30s', '90'], ['1h2m3s', '3723']]) {
    const source = `https://youtu.be/Crm_5n4mvmg?t=${time}&autoplay=1&controls=0&source_ve_path=test`
    assert.equal(youtubeWatchUrl(source), source)
    const embed = new URL(youtubeEmbedUrl(source))
    assert.equal(embed.searchParams.get('start'), seconds)
    assert.equal(embed.searchParams.get('controls'), '1')
    assert.equal(embed.searchParams.has('autoplay'), false)
    assert.equal(embed.searchParams.has('source_ve_path'), false)
  }
  assert.equal(new URL(youtubeEmbedUrl('https://www.youtube.com/embed/Crm_5n4mvmg?start=28')).searchParams.get('start'), '28')
  assert.equal(new URL(youtubeEmbedUrl('https://youtu.be/Crm_5n4mvmg#t=1m')).searchParams.get('start'), '60')
  assert.equal(new URL(youtubeEmbedUrl('https://youtu.be/Crm_5n4mvmg?t=invalid')).searchParams.has('start'), false)
  for (const source of ['https://fake.youtube.com/watch?v=Crm_5n4mvmg', 'javascript:alert(1)']) {
    assert.throws(() => youtubeEmbedUrl(source))
    assert.throws(() => youtubeWatchUrl(source))
  }
})
