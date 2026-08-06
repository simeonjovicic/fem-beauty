import { useEffect, useState } from 'react'
import { BOOKING_URL } from '../data'
import { useBodyLock } from '../hooks'

const navigation = [
  ['story', 'Salon'],
  ['treatments', 'Services'],
  ['reviews', 'Bewertungen'],
  ['vouchers', 'Gutscheine'],
  ['team', 'Team'],
  ['contact', 'Kontakt'],
]

export function Loader() {
  const [done, setDone] = useState(false)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const started = performance.now()
    let finishTimer
    let removeTimer

    const hide = () => {
      const wait = Math.max(0, 1400 - (performance.now() - started))
      finishTimer = window.setTimeout(() => {
        setDone(true)
        removeTimer = window.setTimeout(() => setVisible(false), 600)
      }, wait)
    }

    if (document.readyState === 'complete') hide()
    else window.addEventListener('load', hide, { once: true })

    return () => {
      window.removeEventListener('load', hide)
      window.clearTimeout(finishTimer)
      window.clearTimeout(removeTimer)
    }
  }, [])

  if (!visible) return null

  return (
    <div id="loader" className={done ? 'done' : undefined}>
      <div className="loader-inner">
        <img src="/logo-fem.webp" alt="FEM" className="loader-logo" width="600" height="337" />
        <div className="loader-bar">
          <div className="loader-bar-fill" />
        </div>
      </div>
    </div>
  )
}

export function Header({ home = false }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrollState, setScrollState] = useState(() => ({
    scrolled: !home || window.scrollY > 60,
    progress: 0,
  }))

  useBodyLock(menuOpen)

  useEffect(() => {
    if (!home) return undefined

    let frame = 0
    const update = () => {
      frame = 0
      const scrollMax = document.documentElement.scrollHeight - window.innerHeight
      setScrollState({
        scrolled: window.scrollY > 60,
        progress: scrollMax > 0 ? (window.scrollY / scrollMax) * 100 : 0,
      })
    }
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }

    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    schedule()

    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [home])

  const closeMenu = () => setMenuOpen(false)
  const sectionHref = (id) => (home ? `#${id}` : `/#${id}`)

  return (
    <>
      {home && <div className="scroll-progress" style={{ width: `${scrollState.progress}%` }} />}
      <header>
        <nav className={scrollState.scrolled ? 'scrolled' : undefined} role="navigation" aria-label="Hauptnavigation">
          <a href={home ? '#top' : '/'} className="nav-logo" onClick={closeMenu}>Fem</a>
          <ul className="nav-links">
            {navigation.map(([id, label]) => (
              <li key={id}><a href={sectionHref(id)}>{label}</a></li>
            ))}
          </ul>
          <button
            type="button"
            className={`burger${menuOpen ? ' open' : ''}`}
            aria-label={menuOpen ? 'Menü schließen' : 'Menü öffnen'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span />
            <span />
          </button>
        </nav>

        <div className={`mob${menuOpen ? ' open' : ''}`} onClick={closeMenu}>
          <ul>
            {navigation.map(([id, label]) => (
              <li key={id}><a href={sectionHref(id)}>{label}</a></li>
            ))}
          </ul>
          <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" className="mob-book">
            Termin buchen
          </a>
        </div>
      </header>
    </>
  )
}

function InstagramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

export function Footer() {
  return (
    <footer>
      <div className="ft-inner">
        <div className="ft-left">
          <a href="/" className="ft-logo">Fem</a>
          <span className="ft-copy">© 2025 FEM Beauty Wien. Alle Rechte vorbehalten.</span>
          <a href="https://instagram.com/fem.vienna" target="_blank" rel="noopener noreferrer" className="ft-icon" title="Instagram">
            <InstagramIcon />
            <span className="ft-icon-label">Instagram</span>
          </a>
          <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" className="ft-icon" title="Treatwell">
            <CalendarIcon />
            <span className="ft-icon-label">Treatwell</span>
          </a>
        </div>

        <div className="ft-right">
          <a href="/impressum.html" className="ft-link">Impressum</a>
          <span className="ft-mob-copy">© 2025 FEM Beauty Wien.</span>
          <div className="ft-hango-wrap">
            Made by <a href="https://hango.at" target="_blank" rel="noopener noreferrer" className="ft-hango-highlight">Hango.at</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
