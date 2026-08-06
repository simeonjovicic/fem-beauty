import { useCallback, useEffect, useRef, useState } from 'react'

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const media = window.matchMedia(query)
    const update = (event) => setMatches(event.matches)

    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])

  return matches
}

export function useBodyLock(locked) {
  useEffect(() => {
    if (!locked) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [locked])
}

export function useSwipe(onPrevious, onNext, threshold = 50) {
  const start = useRef(null)

  const onPointerDown = useCallback((event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    start.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }, [])

  const onPointerUp = useCallback(
    (event) => {
      if (!start.current) return

      const deltaX = event.clientX - start.current.x
      const deltaY = event.clientY - start.current.y
      start.current = null

      if (Math.abs(deltaX) < threshold || Math.abs(deltaY) > Math.abs(deltaX)) return
      if (deltaX < 0) onNext()
      else onPrevious()
    },
    [onNext, onPrevious, threshold],
  )

  const onPointerCancel = useCallback(() => {
    start.current = null
  }, [])

  return { onPointerDown, onPointerUp, onPointerCancel }
}

export function useRevealAnimations(enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('on')
        })
      },
      { threshold: 0.06, rootMargin: '0px 0px -30px 0px' },
    )

    const lineObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('on')
          lineObserver.unobserve(entry.target)
        })
      },
      { threshold: 0.3 },
    )

    const imageObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('revealed')
          imageObserver.unobserve(entry.target)
        })
      },
      { threshold: 0.15 },
    )

    document.querySelectorAll('.rv').forEach((element) => revealObserver.observe(element))
    document.querySelectorAll('.anim-line').forEach((element) => lineObserver.observe(element))
    document.querySelectorAll('.portrait-img-wrap').forEach((element) => imageObserver.observe(element))

    return () => {
      revealObserver.disconnect()
      lineObserver.disconnect()
      imageObserver.disconnect()
    }
  }, [enabled])
}
