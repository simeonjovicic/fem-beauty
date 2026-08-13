import { useCallback, useEffect, useRef, useState } from 'react'
import { Footer, Header, Loader } from './components/Chrome'
// Bewusst kein Import aus VoucherShop: der Konfigurator lebt jetzt auf
// /gutscheine.html, und das Band bringt seine Grafik selbst mit. Sonst
// laege der ganze Shop wieder im Bundle der Startseite.
import { BOOKING_URL, reviews, services } from './data'
import {
  useBodyLock,
  useMediaQuery,
  useRevealAnimations,
  useSwipe,
} from './hooks'

function BookingLink({ children, className, style }) {
  return (
    <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" className={className} style={style}>
      {children}
    </a>
  )
}

function HeroTrust() {
  const ratingRef = useRef(null)
  const reviewsRef = useRef(null)

  useEffect(() => {
    const ratingElement = ratingRef.current
    const reviewsElement = reviewsRef.current
    if (!ratingElement || !reviewsElement) return undefined

    const render = (rating, reviewCount) => {
      ratingElement.textContent = rating.toFixed(1).replace('.', ',')
      reviewsElement.textContent = String(Math.round(reviewCount)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      render(4.9, 1420)
      return undefined
    }

    let frame
    let started
    const duration = 1700
    const step = (timestamp) => {
      if (!started) started = timestamp
      const progress = Math.min((timestamp - started) / duration, 1)
      const eased = 1 - (1 - progress) ** 3
      render(eased * 4.9, eased * 1420)
      if (progress < 1) frame = window.requestAnimationFrame(step)
    }
    const timer = window.setTimeout(() => {
      frame = window.requestAnimationFrame(step)
    }, 1100)

    return () => {
      window.clearTimeout(timer)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div
      className="hero-trust"
      aria-label="5 Sterne, 4,9 von 5 und mehr als 1.420 Bewertungen auf Treatwell und Google"
    >
      <div className="hero-trust-rating">
        <span className="hero-trust-stars" aria-hidden="true">★★★★★</span>
        <span className="hero-trust-score" ref={ratingRef}>0,0</span>
      </div>
      <span className="hero-trust-sep" aria-hidden="true">·</span>
      <span className="hero-trust-text"><span ref={reviewsRef}>0</span>+ Bewertungen auf Treatwell & Google</span>
    </div>
  )
}

function Hero() {
  return (
    <section className="hero" id="top">
      {/* Kennzeichnung am Bild selbst, nicht nur im Impressum: die
          Transparenzpflicht verlangt den Hinweis beim ersten Kontakt. */}
      <span className="hero-ai-note">AI generated</span>
      <div className="hero-bg">
        <picture>
          <source media="(max-width: 768px)" srcSet="/hero-mobile-v1.webp" />
          <img
            src="/hero-1080.webp"
            srcSet="/hero-640.webp 640w, /hero-1080.webp 1080w, /hero-1920.webp 1920w"
            sizes="100vw"
            width="1920"
            height="1071"
            fetchPriority="high"
            alt="Entspannende Head-Spa-Behandlung bei FEM Beauty in Wien"
          />
        </picture>
      </div>
      <div className="hero-inner">
        <div className="hero-content">
          <div className="hero-accent" />
          <span className="hero-tag">Wien 1050 · Seit 2023</span>
          <h1 className="hero-title">Schönheit<br /><em>neu</em><br />definiert.</h1>
          <p className="hero-desc">Kosmetik, Head Spa & High-Tech Treatments — vereint in einem Salon.</p>
          <div className="hero-btns">
            <BookingLink className="btn-p">Termin buchen</BookingLink>
            <a href="#treatments" className="btn-o">Entdecken</a>
          </div>
          <HeroTrust />
        </div>
      </div>
      <div className="hero-scroll"><span>Scroll</span><div className="hero-scroll-line" /></div>
    </section>
  )
}

function UspStrip() {
  const items = [
    ['01', 'High-Tech & Chinesische Medizin', 'HIFU, Carbon Laser & Radiofrequenz vereint mit jahrtausendealtem Wissen.'],
    ['02', 'Premium Marken', 'iS Clinical · Babor · Fillmed · NewSha — nur im Profi-Bereich.'],
    ['03', 'Individuelle Beratung', 'Persönliche Analyse vor jeder Behandlung. Auf DE · EN · 中文.'],
  ]

  return (
    <section className="usp-strip" aria-label="Vorteile bei FEM Beauty">
      <div className="usp-strip-track">
        {items.map(([number, title, description]) => (
          <div className="usp-strip-item" key={number}>
            <span className="usp-num">{number}</span>
            <div><strong>{title}</strong><p>{description}</p></div>
          </div>
        ))}
      </div>
    </section>
  )
}

function LocationIcon() {
  return (
    <svg width="1em" height="1em" viewBox="0 0 384 512" fill="currentColor" aria-hidden="true">
      <path d="M215.7 499.2C267 435 384 279.4 384 192 384 86 298 0 192 0S0 86 0 192c0 87.4 117 243 168.3 307.2 12.3 15.3 35.1 15.3 47.4 0zM192 128a64 64 0 1 1 0 128 64 64 0 1 1 0-128z" />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.35 2.46 3.5 5.46 3.5 9S14.35 18.54 12 21M12 3C9.65 5.46 8.5 8.46 8.5 12S9.65 18.54 12 21" />
    </svg>
  )
}

function CupIcon() {
  return (
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 9h11v4.5a5.5 5.5 0 0 1-11 0V9Z" />
      <path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16M4 20h14M8 4.5c0 1 1 1 1 2M12 3.5c0 1 1 1 1 2" />
    </svg>
  )
}

function Story({ openImage }) {
  return (
    <section className="story" id="story">
      <div className="story-img">
        <img
          src="/foto-store-4.webp"
          width="599"
          height="800"
          alt="FEM Beauty Salon Eingangsbereich — Ramperstorffergasse 51, Wien 1050"
          loading="eager"
          fetchPriority="high"
          onClick={() => openImage('/foto-store-4.webp')}
        />
      </div>
      <div className="story-text">
        <span className="tag rv">Über uns</span>
        <h2 className="rv d1">Schönheit &<br /><em>Entspannung</em><br />im Herzen Wiens.</h2>
        <div className="line anim-line" />
        <p className="rv d2">Der Kosmetiksalon FEM steht für moderne Ausstattung, höchste Hygienestandards und eine stilvolle Atmosphäre in Wien 1050. In ruhigem Ambiente verbinden wir professionelle Kosmetik mit Entspannung und individueller Betreuung.</p>
        <div className="story-pills rv d3">
          <span><i><LocationIcon /></i> U4 Pilgramgasse</span>
          <span><i><GlobeIcon /></i> DE · EN · 中文</span>
          <span><i><CupIcon /></i> WLAN-Getränke zur Begrüßung</span>
        </div>
      </div>
    </section>
  )
}

const galleryImages = [
  ['/foto-store-2.webp', 600, 800, 'FEM Beauty Wien — Behandlungsraum für Gesichtsbehandlungen'],
  ['/foto-store-3.webp', 800, 599, 'Premium Kosmetikprodukte bei FEM — iS Clinical, Babor, Fillmed'],
  ['/foto-store-0.webp', 600, 800, 'FEM Kosmetiksalon Interieur — stilvolle Atmosphäre Wien 1050'],
  ['/foto-store-1.webp', 800, 600, 'FEM Beauty Logo und Empfangsbereich'],
]

function Gallery({ openImage }) {
  // Auf Mobile lag hier zusaetzlich das Portrait aus der Story-Sektion, was
  // fuenf Bilder ergab und damit eine unvollstaendige Reihe. Wie vor dem
  // Umbau sind es wieder vier — ein glattes Zweier-Raster.

  // Statisches Raster statt Laufband: die zweite, aria-hidden Kopie der Bilder
  // war nur noetig, damit die Endlosbewegung nahtlos umschlug.
  return (
    <section className="gallery" aria-label="Einblicke in den Salon">
      <div className="gallery-track">
        {galleryImages.map(([src, width, height, alt]) => (
          <button
            type="button"
            className="gallery-item"
            aria-label={`Foto vergrößern: ${alt}`}
            onClick={() => openImage(src)}
            key={src}
          >
            <img
              src={src}
              width={width}
              height={height}
              alt={alt}
              loading="lazy"
              decoding="async"
            />
          </button>
        ))}
      </div>
    </section>
  )
}

function BrandsMarquee() {
  const brands = ['iS Clinical', 'Babor', 'Fillmed', 'NewSha']
  return (
    <div className="brands-marquee" aria-label="Verwendete Marken">
      <div className="brands-marquee-track">
        {Array.from({ length: 3 }, (_, repetition) => brands.map((brand) => (
          <span key={`${repetition}-${brand}`} style={{ display: 'contents' }}>
            <span className="bm-item">{brand}</span><span className="bm-dot">·</span>
          </span>
        )))}
      </div>
    </div>
  )
}

// Aufklappen in der Karte statt Overlay-Modal: der Klick blendet ein Panel
// ueber die Karte selbst ein (position:absolute, inset:0), das Raster bleibt
// stehen. Entspricht dem Verhalten vor dem React-Rebuild.
function ServiceCard({ service, isOpen, onToggle, onClose }) {
  const panelId = `srv-panel-${service.id}`
  const frontRef = useRef(null)
  const closeRef = useRef(null)
  const panelRef = useRef(null)
  const restoreFocus = useRef(false)

  // Beim Oeffnen deckt das Panel die Vorderseite ab und diese wird inert —
  // ohne Fokuswechsel landet der Fokus sonst im Nichts. Zurueck geht er nur
  // beim Schliessen ueber das ✕: erst nach dem Rerender ist das inert weg,
  // ein focus() direkt im Klickhandler liefe ins Leere. Escape und Klick
  // daneben lassen den Fokus bewusst dort, wo der Zeiger hingegangen ist.
  //
  // preventScroll ist hier Pflicht, nicht Politur: beim Fokussieren steht das
  // Panel noch auf translateY(100%), und mit html{scroll-behavior:smooth}
  // gleitet die Seite sonst zu dieser Position und wieder zurueck — die
  // Einblendung sieht dann aus, als schoesse die Karte nach oben durch.
  useEffect(() => {
    if (isOpen) {
      if (panelRef.current) panelRef.current.scrollTop = 0
      closeRef.current?.focus({ preventScroll: true })
    } else if (restoreFocus.current) {
      restoreFocus.current = false
      frontRef.current?.focus({ preventScroll: true })
    }
  }, [isOpen])

  const closeAndRestore = () => {
    restoreFocus.current = true
    onClose()
  }

  return (
    <div className={`srv-card${isOpen ? ' open' : ''}`} data-srv={service.id}>
      <button
        ref={frontRef}
        type="button"
        className="srv-card-front"
        aria-expanded={isOpen}
        aria-controls={panelId}
        inert={isOpen}
        onClick={onToggle}
      >
        <span className="srv-num">{service.number}</span>
        <span className="srv-icon" aria-hidden="true">+</span>
        <h3>{service.title}</h3>
        <span className="srv-hint">Mehr erfahren <i aria-hidden="true">→</i></span>
      </button>

      <div className="srv-card-expanded" id={panelId} ref={panelRef} inert={!isOpen}>
        <button
          ref={closeRef}
          type="button"
          className="srv-close"
          aria-label={`${service.title} schließen`}
          onClick={closeAndRestore}
        >
          ✕
        </button>
        <span className="srv-num">{service.number}</span>
        <h3>{service.expandedTitle || service.title}</h3>
        <p>{service.description}</p>
        <div className="srv-tags">
          {service.tags.map((tag) => <span key={tag}>{tag}</span>)}
        </div>
        <BookingLink className="srv-book">Jetzt buchen →</BookingLink>
      </div>
    </div>
  )
}

const visibleServices = services.filter((service) => !service.placeholder)

function Services() {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [openId, setOpenId] = useState(null)
  const [current, setCurrent] = useState(0)
  const closeCard = useCallback(() => setOpenId(null), [])

  // Klick daneben und Escape schliessen, wie in der Fassung vor dem Rebuild.
  // Der oeffnende Klick selbst kann hier nicht durchschlagen: sein Ziel liegt
  // per Definition innerhalb einer .srv-card.
  useEffect(() => {
    if (!openId) return undefined

    const closeOnOutside = (event) => {
      if (!event.target.closest('.srv-card')) setOpenId(null)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpenId(null)
    }

    document.addEventListener('click', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('click', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [openId])

  const previous = useCallback(() => {
    setCurrent((index) => (index - 1 + visibleServices.length) % visibleServices.length)
    setOpenId(null)
  }, [])
  const next = useCallback(() => {
    setCurrent((index) => (index + 1) % visibleServices.length)
    setOpenId(null)
  }, [])
  const swipeHandlers = useSwipe(previous, next)

  const serviceCards = visibleServices.map((service) => (
    <ServiceCard
      key={service.id}
      service={service}
      isOpen={openId === service.id}
      onToggle={() => setOpenId((id) => (id === service.id ? null : service.id))}
      onClose={closeCard}
    />
  ))

  return (
    <>
      <section className="services">
        <div className="services-inner">
          <div className="services-head rv">
            <span className="tag">Im Überblick</span>
            <h2>Weitere <em>Treatments.</em></h2>
            <p className="services-sub">Wähle eine Behandlung und entdecke alle Details.</p>
          </div>

          <div className="srv-grid" {...(isMobile ? swipeHandlers : {})}>
            {isMobile ? (
              <div className="slider-track" style={{ transform: `translateX(-${current * 100}%)` }}>
                {serviceCards}
              </div>
            ) : serviceCards}
          </div>

          <div className="srv-mobile-nav">
            <div className="mob-dots srv-dots">
              {visibleServices.map((service, index) => (
                <button
                  type="button"
                  className={`mob-dot${index === current ? ' active' : ''}`}
                  aria-label={`${service.title} anzeigen`}
                  key={service.id}
                  onClick={() => { setCurrent(index); setOpenId(null) }}
                />
              ))}
            </div>
            <p className="mob-counter srv-counter">{current + 1} / {visibleServices.length}</p>
            <p className="mob-swipe-hint">← Wischen für mehr →</p>
          </div>

          <div className="services-cta"><BookingLink className="link-arrow">Alle Preise auf Treatwell →</BookingLink></div>
        </div>
      </section>
    </>
  )
}

// Dachzeile fuer den gesamten Behandlungsteil: steht ueber Head Spa und traegt
// deshalb auch den #treatments-Anker — der Bereich beginnt hier, nicht erst
// beim Kartenraster.
function ServicesIntro() {
  return (
    <section className="services services-intro" id="treatments">
      <div className="services-inner">
        <div className="services-head rv">
          <span className="tag">Behandlungen</span>
          <h2>Unsere <em>Services.</em></h2>
          <p className="services-sub">Vom Signature Head Spa bis zur klassischen Kosmetik — alles unter einem Dach.</p>
        </div>
      </div>
    </section>
  )
}

function HeadSpa() {
  const facial = services.find((service) => service.id === 'face')
  const facialHighlights = [
    ['Klassische Gesichtspflege', 'individuell abgestimmt'],
    ['Hydro Peel', '75 Min.'],
    ['Carbon Laser', 'High-Tech Facial'],
    ['HIFU & Radiofrequenz', 'straffende Methoden'],
  ]

  return (
    <section className="headspa" id="headspa">
      <div className="headspa-visual">
        <span className="headspa-ai-note">AI generated</span>
        <picture>
          <img
            src="/NewGesichtsbehanldung.png"
            alt="Gesichtsbehandlung bei FEM Beauty Wien — eine Kosmetikerin trägt sanft eine Gesichtsmaske auf"
            loading="lazy"
            decoding="async"
          />
        </picture>
      </div>

      <div className="headspa-body">
        <span className="tag rv">Hautpflege & High-Tech</span>
        <h2 className="rv d1">Gesichts<em>behandlungen.</em></h2>
        <div className="line anim-line" />
        <p className="headspa-lead rv d2">{facial.summary}</p>
        <p className="headspa-desc rv d2">{facial.description}</p>

        <ul className="headspa-variants rv d3">
          {facialHighlights.map(([name, detail]) => (
            <li key={name}>
              <span className="headspa-variant-name">{name}</span>
              <span className="headspa-variant-dur">{detail}</span>
            </li>
          ))}
        </ul>

        <div className="headspa-tags rv d3">
          {facial.tags.map((tag) => <span key={tag}>{tag}</span>)}
        </div>

        <div className="headspa-cta rv d3">
          <BookingLink className="btn-p">Gesichtsbehandlung buchen</BookingLink>
        </div>
      </div>
    </section>
  )
}

// Eigene, kleine Icons statt eines Imports aus VoucherShop — der Shop liegt
// auf /gutscheine.html und soll nicht ins Bundle der Startseite zurueck.
function VtIcon({ name }) {
  const common = {
    width: '1em', height: '1em', viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: '1.4',
    strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
  }

  if (name === 'gift') {
    return (
      <svg {...common}>
        <path d="M4 10.5h16V20H4zM3 7.5h18v3H3zM12 7.5V20" />
        <path d="M12 7.5H8.8C6.3 7.5 5.6 4 8 3.9c2.1-.1 4 3.6 4 3.6ZM12 7.5h3.2c2.5 0 3.2-3.5.8-3.6-2.1-.1-4 3.6-4 3.6Z" />
      </svg>
    )
  }

  if (name === 'clock') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8.6" />
        <path d="M12 7.3V12l3.2 2" />
      </svg>
    )
  }

  return (
    <svg {...common}>
      <path d="M12 20s-7-4.4-7-9.2A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.8C19 15.6 12 20 12 20Z" />
    </svg>
  )
}

const VT_FEATURES = [
  ['gift', 'Perfekt als Geschenk'],
  ['clock', 'Flexibel einlösbar'],
  ['heart', 'Rundum wohltuend'],
]

function VoucherTeaser() {
  return (
    <section className="voucher-teaser" id="vouchers">
      <div className="voucher-teaser-inner">
        {/* Zwei gepraegte Karten, in CSS gebaut. Kein Import aus VoucherShop:
            der Konfigurator liegt auf /gutscheine.html und soll nicht ins
            Bundle der Startseite zurueck. */}
        <div className="vt-stack" aria-hidden="true">
          <div className="vt-card vt-card-back">
            <span className="vt-card-kicker">Zeit für dich.</span>
            <span className="vt-card-seal">f</span>
          </div>
          <div className="vt-card vt-card-front">
            <span className="vt-card-kicker">Gutschein</span>
            <span className="vt-card-mark">fem</span>
            <span className="vt-card-foot">
              <span>Head Spa</span>
              <span>No. 0001</span>
            </span>
          </div>
        </div>

        <div className="vt-content">
        <span className="vt-kicker rv">Ihr Gutschein</span>
        <h2 className="rv d1">Zeit für dich.<br /><em>Zum Verschenken.</em></h2>
        <div className="vt-rule rv d1" />
        <p className="rv d2">
          Eine wohltuende Auszeit, schenken oder selbst genießen.<br />
          Head Spa — pure Entspannung für Kopfhaut, Haar und Sinne.
        </p>

        <ul className="vt-features rv d2">
          {VT_FEATURES.map(([icon, label]) => (
            <li key={label}><VtIcon name={icon} />{label}</li>
          ))}
        </ul>

          <a className="vt-cta rv d3" href="/gutscheine.html">
            Gutschein kaufen <i aria-hidden="true">→</i>
          </a>
        </div>
      </div>
    </section>
  )
}

function Stats() {
  const sectionRef = useRef(null)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return undefined

    const frames = new Set()
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      observer.disconnect()

      section.querySelectorAll('.stat-num[data-count]').forEach((element) => {
        const target = Number(element.dataset.count)
        const decimal = element.hasAttribute('data-decimal')
        const grouped = element.hasAttribute('data-grouped')
        const started = performance.now()

        const formatValue = (value, final = false) => {
          if (decimal) return value.toFixed(1).replace('.', ',')
          const rounded = final ? Math.round(value) : Math.floor(value)
          return grouped ? String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : rounded
        }

        const step = (now) => {
          const progress = Math.min((now - started) / 2000, 1)
          const eased = progress === 1 ? 1 : 1 - 2 ** (-10 * progress)
          const value = eased * target
          element.textContent = formatValue(value)
          if (progress < 1) {
            const frame = requestAnimationFrame(step)
            frames.add(frame)
          } else {
            element.textContent = formatValue(target, true)
          }
        }

        const frame = requestAnimationFrame(step)
        frames.add(frame)
      })
    }, { threshold: 0.3 })

    observer.observe(section)
    return () => {
      observer.disconnect()
      frames.forEach((frame) => cancelAnimationFrame(frame))
    }
  }, [])

  const stats = [
    [6, '+', 'Jahre Erfahrung', false, false, false],
    [8, '', 'Expertinnen', false, false, true],
    [4.9, '★', 'Bewertung', true, false, false],
    [1420, '+', 'Bewertungen', false, true, false],
  ]

  return (
    <section className="stats-strip" ref={sectionRef}>
      {stats.map(([count, suffix, label, decimal, grouped, mobileHidden], index) => (
        <div key={label} className={`stat-entry${mobileHidden ? ' stat-entry-mobile-hidden' : ''}`}>
          {index > 0 && <div className="stat-divider" />}
          <div className="stat-item rv" style={{ transitionDelay: `${index * 0.08}s` }}>
            <div className="stat-num-wrap">
              <span
                className="stat-num"
                data-count={count}
                {...(decimal ? { 'data-decimal': true } : {})}
                {...(grouped ? { 'data-grouped': true } : {})}
              >0</span>
              <span className="stat-suffix">{suffix}</span>
            </div>
            <span className="stat-label">{label}</span>
          </div>
        </div>
      ))}
    </section>
  )
}

function ReviewCard({ review, interactive = true }) {
  const [expanded, setExpanded] = useState(false)
  const canExpand = review.text.length > 180

  return (
    <article className="review-card" data-platform={review.platform}>
      <span className={`review-platform ${review.platform === 'google' ? 'go' : 'tw'}`}>
        {review.platform === 'google' ? 'Google' : 'Treatwell ✓'}
      </span>
      <div className="review-stars">★★★★★</div>
      <div className="review-text-wrap">
        <p className={`review-text${canExpand ? ' clamped' : ''}${expanded ? ' expanded' : ''}`}>{review.text}</p>
        {canExpand && interactive && (
          <button type="button" className="review-more review-more-button" onClick={() => setExpanded((value) => !value)}>
            {expanded ? 'Weniger anzeigen' : 'Mehr anzeigen'}
          </button>
        )}
      </div>
      <div className="review-author">
        <div className="review-avatar">{review.name.charAt(0)}</div>
        <div><strong>{review.name}</strong><span>{review.service}</span></div>
      </div>
    </article>
  )
}

const REVIEW_PAGE_MS = 5200

function Reviews() {
  const [filter, setFilter] = useState(null)
  const [page, setPage] = useState(0)
  const [paused, setPaused] = useState(false)
  const isMobile = useMediaQuery('(max-width: 768px)')
  // Verbleibende Zeit bis zum naechsten Wechsel und der Zeitpunkt, an dem
  // sie zuletzt zu laufen begann. startedRef === null heisst: haelt gerade.
  const remainingRef = useRef(REVIEW_PAGE_MS)
  const startedRef = useRef(null)

  const filtered = filter ? reviews.filter((review) => review.platform === filter) : reviews
  const perPage = isMobile ? 1 : 2

  // Seiten zu je zwei Karten. Der Sprung geht damit immer um eine volle
  // Seite — genau das unterscheidet ihn vom fruehen Endlosband, das nie
  // stillstand und bei dem man nie zu Ende gelesen hatte.
  const pages = []
  for (let index = 0; index < filtered.length; index += perPage) {
    pages.push(filtered.slice(index, index + perPage))
  }

  // Filterwechsel oder Breakpoint-Wechsel aendern die Seitenzahl — ohne
  // Ruecksprung stuende man sonst auf einer Seite, die es nicht mehr gibt.
  // Anpassung waehrend des Renderns statt im Effect: so wird nie ein
  // Zwischenstand mit ungueltiger Seite gezeichnet.
  const pagingKey = `${filter || 'all'}-${perPage}`
  const [lastPagingKey, setLastPagingKey] = useState(pagingKey)
  if (pagingKey !== lastPagingKey) {
    setLastPagingKey(pagingKey)
    setPage(0)
  }

  // Der Zeitgeber laeuft als setTimeout ueber die jeweils verbleibende Zeit,
  // nicht als festes Intervall. Zwei Gruende:
  // – Beim Zeigen auf die Sektion wird nur angehalten. Die Restzeit bleibt
  //   erhalten, beim Verlassen laeuft sie weiter, statt von vorn zu beginnen.
  // – Ein Klick auf die Pfeile setzt die Restzeit bewusst auf die volle
  //   Dauer (siehe go), sonst spraenge die Seite gleich wieder weiter.
  useEffect(() => {
    if (pages.length < 2) return undefined

    if (paused) {
      if (startedRef.current !== null) {
        remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedRef.current))
        startedRef.current = null
      }
      return undefined
    }

    startedRef.current = Date.now()
    const timer = window.setTimeout(() => {
      startedRef.current = null
      remainingRef.current = REVIEW_PAGE_MS
      setPage((current) => (current + 1) % pages.length)
    }, remainingRef.current)

    return () => window.clearTimeout(timer)
  }, [paused, pages.length, page])

  const toggleFilter = (platform) => {
    setFilter((active) => (active === platform ? null : platform))
  }

  // Manuell geblaettert heisst: volle Zeit fuer die neue Seite, sonst liefe
  // die Restzeit der alten weiter und die neue waere sofort wieder weg.
  const go = (next) => {
    remainingRef.current = REVIEW_PAGE_MS
    startedRef.current = null
    setPage((current) => (current + next + pages.length) % pages.length)
  }

  const totalLabel = filter === 'treatwell'
    ? 'Nur Treatwell Bewertungen'
    : filter === 'google'
      ? 'Nur Google Bewertungen'
      : '1.420+ verifizierte Bewertungen'

  return (
    <section className="reviews" id="reviews">
      <div className="reviews-inner">
        <div className="reviews-head rv">
          <span className="tag">Kundenstimmen</span>
          <h2>Was unsere <em>Kunden sagen.</em></h2>
          <div className="reviews-sources">
            <button
              type="button"
              className={`reviews-src-pill tw-pill${filter === 'treatwell' ? ' active' : ''}`}
              aria-label="Nur Treatwell-Bewertungen filtern"
              aria-pressed={filter === 'treatwell'}
              onClick={() => toggleFilter('treatwell')}
            >Treatwell <strong>4,9</strong> ★</button>
            <button
              type="button"
              className={`reviews-src-pill go-pill${filter === 'google' ? ' active' : ''}`}
              aria-label="Nur Google-Bewertungen filtern"
              aria-pressed={filter === 'google'}
              onClick={() => toggleFilter('google')}
            >Google <strong>5,0</strong> ★</button>
            <span className="reviews-src-total">{totalLabel}</span>
          </div>
        </div>

        <div
          className="reviews-flow"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
        >
          <div
            className="reviews-flow-track"
            style={{ transform: `translateX(-${page * 100}%)` }}
          >
            {pages.map((group, pageIndex) => (
              <div
                className="reviews-page"
                key={`${filter || 'all'}-${pageIndex}`}
                inert={pageIndex !== page}
              >
                {group.map((review, reviewIndex) => (
                  <ReviewCard
                    review={review}
                    interactive
                    key={`${review.name}-${reviewIndex}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {pages.length > 1 && (
          <div className="reviews-pager">
            <button type="button" className="reviews-pager-arrow" aria-label="Vorherige Bewertungen" onClick={() => go(-1)}>←</button>
            {/* Zaehler statt Punkten: bei 24 Bewertungen waeren es je nach
                Breite 12 bis 24 Punkte — als Fortschritt nicht mehr lesbar
                und als Ziel zu klein zum Treffen. */}
            <div className="reviews-pager-status">
              <p className="reviews-pager-count" aria-live="polite">
                <strong>{page + 1}</strong> / {pages.length}
              </p>
              {/* Laeuft bis zum naechsten Wechsel. Der Schluessel haengt nur
                  an der Seite, nicht am Pausenzustand: beim Zeigen friert die
                  Animation ein und laeuft danach weiter — genau wie der
                  Zeitgeber. Mit paused im Schluessel spraenge sie auf null. */}
              <div className="reviews-progress" aria-hidden="true">
                <span
                  key={page}
                  style={{
                    animationDuration: `${REVIEW_PAGE_MS}ms`,
                    animationPlayState: paused ? 'paused' : 'running',
                  }}
                />
              </div>
            </div>
            <button type="button" className="reviews-pager-arrow" aria-label="Nächste Bewertungen" onClick={() => go(1)}>→</button>
          </div>
        )}

        <div className="reviews-cta"><BookingLink className="link-arrow">Alle Bewertungen lesen →</BookingLink></div>
      </div>
    </section>
  )
}

function Owner() {
  const [expanded, setExpanded] = useState(false)
  return (
    <section className="owner-section" id="team">
      <div className="owner-bg-grid" />
      <div className="owner-inner rv">
        <div className="owner-text-col">
          <div className="owner-header">
            <span className="tag rv">Über mich</span>
            <h2 className="owner-title rv d1">Jenny,<br /><em>Inhaberin.</em></h2>
          </div>
          <blockquote className="owner-quote rv d2">„Kosmetik ist für mich mehr als äußere Pflege — sie ist eine Einladung, den Alltag hinter sich zu lassen.“</blockquote>
          <div className="owner-divider rv d2" />
          <div className="about-text-wrap" style={{ marginTop: 0 }}>
            <div className={`about-text-content owner-body${expanded ? ' expanded' : ''}`}>
              <p className="rv d3">Geboren in China und seit 1996 in Österreich zu Hause, trage ich zwei Kulturen in meinem Herzen – und verbinde sie in meiner Arbeit zu einem ganzheitlichen Konzept von Schönheit und Wohlbefinden.</p>
              <p className="rv" style={{ transitionDelay: '0.45s' }}>Seit 2018 widme ich mich mit großer Leidenschaft der Kosmetik. Mein beruflicher Weg begann in der Korean Beauty Care in Asien, bevor ich meine Ausbildung in Wien vertiefte und die Meisterprüfung im Kosmetikbereich erfolgreich abschloss. Mit der Eröffnung meines eigenen Kosmetikstudios „Fem“ im April 2023 habe ich mir einen Herzenswunsch erfüllt.</p>
              <p className="rv" style={{ transitionDelay: '0.55s' }}>In meinen Behandlungen vereine ich klassische Kosmetik mit ausgewählten Methoden der traditionellen chinesischen Medizin sowie modernen Behandlungstechniken. Jede Anwendung wird individuell auf die persönlichen Bedürfnisse abgestimmt und achtsam, ganzheitlich sowie mit viel Feingefühl durchgeführt.</p>
            </div>
            <button type="button" className="about-more about-more-button" onClick={() => setExpanded((value) => !value)}>
              {expanded ? 'Weniger lesen' : 'Mehr lesen...'}
            </button>
          </div>
          <div className="owner-footer-row rv" style={{ transitionDelay: '0.7s' }}>
            <BookingLink className="btn-p">Termin buchen</BookingLink>
            <div className="owner-langs"><span>DE</span><span>EN</span><span>中文</span></div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Lightbox({ image, onClose }) {
  useBodyLock(Boolean(image))

  useEffect(() => {
    if (!image) return undefined
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [image, onClose])

  if (!image) return null

  return (
    <div className="lightbox active" role="dialog" aria-modal="true" aria-label="Bildansicht" onClick={onClose}>
      <button type="button" className="lightbox-close" aria-label="Schließen" onClick={onClose}>×</button>
      <img className="lightbox-content" src={image} alt="Vergrößerte Ansicht" onClick={(event) => event.stopPropagation()} />
    </div>
  )
}

function Contact() {
  return (
    <section className="contact" id="contact">
      <div className="contact-info">
        <span className="tag">Kontakt & Buchung</span>
        <h2>Bereit für<br /><em>dein Erlebnis?</em></h2>
        <div className="line anim-line" />
        <p>Alle Behandlungen beginnen mit einer persönlichen Beratung.</p>
        <div className="contact-details">
          <div><strong>Adresse</strong><span>Ramperstorffergasse 51, 1050 Wien</span></div>
          <div><strong>Telefon</strong><a href="tel:+436608866068">+43 660 8866068</a></div>
          <div><strong>E-Mail</strong><a href="mailto:beauty@fembeauty.at">beauty@fembeauty.at</a></div>
          <div><strong>Instagram</strong><a href="https://instagram.com/fem.vienna" target="_blank" rel="noopener noreferrer">@fem.vienna</a></div>
          <div><strong>Zeiten</strong><span>Mo–Fr 09–19 · Sa 09–18</span></div>
        </div>
        <BookingLink className="btn-p" style={{ marginTop: '2.5rem' }}>Jetzt über Treatwell buchen →</BookingLink>
      </div>
      <div className="contact-map">
        <iframe
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2659.2!2d16.3558!3d48.1857!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x476da836d80ebf75%3A0x3e5a9d2f7b6c1234!2sRamperstorffergasse+51%2C+1050+Wien!5e0!3m2!1sde!2sat!4v1710000000000"
          width="100%"
          height="100%"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="FEM Beauty Wien"
        />
      </div>
    </section>
  )
}

function Faq() {
  return (
    <section className="seo-faq" aria-label="Häufig gestellte Fragen">
      <h2>Häufig gestellte Fragen zu FEM Beauty Wien</h2>
      <dl>
        <dt>Wo befindet sich der Kosmetiksalon FEM in Wien?</dt>
        <dd>FEM Beauty befindet sich in der Ramperstorffergasse 51, 1050 Wien, direkt bei der U4-Station Pilgramgasse.</dd>
        <dt>Welche Behandlungen bietet FEM Beauty an?</dt>
        <dd>FEM bietet Gesichtsbehandlungen (klassisch, HIFU, Carbon Laser, Radiofrequenz), japanische Head Spa, Maniküre, Pediküre, Waxing, Laser-Haarentfernung sowie Wimpernlifting und Augenbrauen-Styling.</dd>
        <dt>In welchen Sprachen wird bei FEM beraten?</dt>
        <dd>Das Team bei FEM berät auf Deutsch, Englisch und Chinesisch (中文).</dd>
        <dt>Wie kann ich einen Termin bei FEM buchen?</dt>
        <dd>Termine können rund um die Uhr online über Treatwell gebucht werden, oder telefonisch unter +43 660 8866068.</dd>
        <dt>Welche Öffnungszeiten hat FEM Beauty Wien?</dt>
        <dd>FEM hat Montag bis Freitag von 09:00 bis 19:00 Uhr und Samstag von 09:00 bis 18:00 Uhr geöffnet.</dd>
        <dt>Welche Kosmetikmarken verwendet FEM?</dt>
        <dd>FEM arbeitet mit professionellen Marken wie iS Clinical, Babor, Fillmed und NewSha.</dd>
      </dl>
    </section>
  )
}

export default function HomePage() {
  const [lightboxImage, setLightboxImage] = useState(null)
  const closeLightbox = useCallback(() => setLightboxImage(null), [])

  useRevealAnimations()

  return (
    <>
      <Loader />
      <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" className="float-cta">
        <span className="float-dot" />
        <span className="float-cta-label-full">Termin buchen</span>
        <span className="float-cta-label-short">Buchen</span>
      </a>
      <Header home />
      <main>
        <Hero />
        <UspStrip />
        <Story openImage={setLightboxImage} />
        <Gallery openImage={setLightboxImage} />
        <BrandsMarquee />
        <ServicesIntro />
        <HeadSpa />
        <Services />
        <Stats />
        <Reviews />
        <VoucherTeaser />
        <Owner />
        <Contact />
      </main>
      <Lightbox image={lightboxImage} onClose={closeLightbox} />
      <Faq />
      <Footer />
    </>
  )
}
