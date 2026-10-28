import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'

export function useLessonFocus(pageKey: Ref<string>, enabled: Ref<boolean>) {
  const desktop = ref(false)
  const active = ref(false)
  const pinned = ref(false)
  const drawer = ref<'course' | 'outline' | null>(null)
  const available = computed(() => desktop.value && enabled.value)
  const playerSlot = ref<HTMLElement | null>(null)
  const trigger = ref<HTMLElement | null>(null)
  const pageTop = ref<HTMLElement | null>(null)
  const reservedHeight = ref<number>()
  let mounted = false
  let dismissed = false
  let observer: IntersectionObserver | undefined
  let topObserver: IntersectionObserver | undefined
  let media: MediaQueryList
  let revision = 0
  const hiddenDirectories = new Map<HTMLElement, boolean>()
  const drawerAttributes = new Map<HTMLElement, Map<string, string | null>>()

  function drawerPanel(side: 'course' | 'outline') {
    return document.querySelector<HTMLElement>(side === 'course' ? '.VPSidebar' : '.VPDoc .aside')
  }

  function closeDrawer(returnFocus = true) {
    const previous = drawer.value
    drawer.value = null
    document.documentElement.classList.remove('lesson-focus-course-open', 'lesson-focus-outline-open')
    for (const [element, attributes] of drawerAttributes) {
      for (const [name, value] of attributes) {
        if (value === null) element.removeAttribute(name)
        else element.setAttribute(name, value)
      }
    }
    drawerAttributes.clear()
    if (active.value) for (const element of hiddenDirectories.keys()) element.inert = true
    if (returnFocus && previous) document.querySelector<HTMLElement>(`[data-focus-drawer="${previous}"]`)?.focus({ preventScroll: true })
  }

  async function toggleDrawer(side: 'course' | 'outline') {
    if (!active.value) return
    if (drawer.value === side) return closeDrawer()
    closeDrawer(false)
    const panel = drawerPanel(side)
    if (!panel) return
    drawer.value = side
    drawerAttributes.set(panel, new Map(['role', 'aria-modal', 'aria-label'].map(name => [name, panel.getAttribute(name)])))
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-modal', 'true')
    panel.setAttribute('aria-label', side === 'course' ? 'Course directory' : 'On this page')
    panel.inert = false
    document.documentElement.classList.add(`lesson-focus-${side}-open`)
    await nextTick()
    if (drawer.value === side) panel.querySelector<HTMLElement>('button, a[href]')?.focus({ preventScroll: true })
  }

  function restoreDirectories() {
    for (const [element, wasInert] of hiddenDirectories) element.inert = wasInert
    hiddenDirectories.clear()
  }

  async function setActive(value: boolean, manual = false) {
    if (value === active.value || (value && (!available.value || pinned.value || document.fullscreenElement))) return
    const change = ++revision
    // Preserve the paragraph in view while the reading column changes width.
    const anchor = Array.from(document.querySelectorAll<HTMLElement>('.vp-doc h1, .vp-doc h2, .vp-doc h3, .vp-doc p, .vp-doc pre, .vp-doc table'))
      .find(element => {
        const rect = element.getBoundingClientRect()
        return rect.top >= 160 && rect.top < window.innerHeight && rect.height > 0
      })
    const previousTop = anchor?.getBoundingClientRect().top
    const readingStarted = (trigger.value?.getBoundingClientRect().top ?? Infinity) < 160
    closeDrawer(false)
    if (value) {
      reservedHeight.value = playerSlot.value?.getBoundingClientRect().height
      document.querySelectorAll<HTMLElement>('.VPSidebar, .VPDoc .aside').forEach(element => {
        hiddenDirectories.set(element, element.inert)
        element.inert = true
      })
    } else restoreDirectories()
    active.value = value
    document.documentElement.classList.toggle('lesson-focus', value)
    await nextTick()
    if (change !== revision) return
    if (manual && value && !readingStarted) document.querySelector('.vp-doc')?.scrollIntoView({ block: 'start', behavior: 'instant' })
    else if (anchor && previousTop !== undefined) window.scrollBy({ top: anchor.getBoundingClientRect().top - previousTop, behavior: 'instant' })
    if (!value) reservedHeight.value = undefined
  }

  function exit() {
    dismissed = true
    void setActive(false)
  }

  async function setLayout(mode: 'split' | 'pinned') {
    pinned.value = mode === 'pinned'
    try { localStorage.setItem('datatalks-learning:reading-layout', mode) } catch { /* Keep the choice for this session when storage is unavailable. */ }
    if (pinned.value) exit()
    else {
      dismissed = false
      await setActive(true, true)
    }
  }

  function onKeydown(event: KeyboardEvent) {
    if (drawer.value) {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeDrawer()
      } else if (event.key === 'Tab') {
        const panel = drawerPanel(drawer.value)
        const elements = Array.from(panel?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), [tabindex="0"]') ?? [])
          .filter(element => element.getClientRects().length > 0)
        const first = elements[0], last = elements.at(-1)
        if (event.shiftKey && document.activeElement === first && last) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last && first) { event.preventDefault(); first.focus() }
      }
      return
    }
    if (event.key === 'Escape' && active.value && !document.fullscreenElement) exit()
  }

  function onNavigationClick(event: MouseEvent) {
    if (!drawer.value || !(event.target instanceof Element)) return
    const link = event.target.closest('a[href]')
    if (link && drawerPanel(drawer.value)?.contains(link)) closeDrawer(false)
  }

  async function observePage(resetDismissal = false) {
    observer?.disconnect()
    topObserver?.disconnect()
    if (resetDismissal) dismissed = false
    const setupRevision = ++revision
    closeDrawer(false)
    active.value = false
    reservedHeight.value = undefined
    document.documentElement.classList.remove('lesson-focus')
    restoreDirectories()
    await nextTick()
    if (setupRevision !== revision || !mounted || !available.value || !trigger.value || !pageTop.value) return
    const navHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--vp-nav-height')) || 80
    const threshold = navHeight + 40
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.target === trigger.value && entry.boundingClientRect.top < threshold && !entry.isIntersecting && !dismissed && !pinned.value) void setActive(true)
      }
    }, { rootMargin: `-${threshold}px 0px 0px 0px`, threshold: 0 })
    observer.observe(trigger.value)
    topObserver = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting) && active.value) void setActive(false)
    }, { rootMargin: `-${navHeight}px 0px 0px 0px`, threshold: 0 })
    topObserver.observe(pageTop.value)
  }

  function onViewportChange() {
    desktop.value = media.matches
    void observePage()
  }

  watch([pageKey, enabled], () => { if (mounted) void observePage(true) }, { flush: 'post' })
  onMounted(() => {
    mounted = true
    try { pinned.value = localStorage.getItem('datatalks-learning:reading-layout') === 'pinned' } catch { /* Default to automatic split view. */ }
    media = window.matchMedia('(min-width: 1200px) and (min-height: 650px)')
    media.addEventListener('change', onViewportChange)
    window.addEventListener('keydown', onKeydown)
    document.addEventListener('click', onNavigationClick, true)
    onViewportChange()
  })
  onBeforeUnmount(() => {
    mounted = false
    ++revision
    observer?.disconnect()
    topObserver?.disconnect()
    media?.removeEventListener('change', onViewportChange)
    window.removeEventListener('keydown', onKeydown)
    document.removeEventListener('click', onNavigationClick, true)
    closeDrawer(false)
    document.documentElement.classList.remove('lesson-focus')
    restoreDirectories()
  })

  return { active, available, pinned, drawer, playerSlot, trigger, pageTop, reservedHeight, setLayout, exit, toggleDrawer, closeDrawer }
}
