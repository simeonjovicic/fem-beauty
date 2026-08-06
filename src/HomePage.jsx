import { useCallback, useEffect, useRef, useState } from 'react'
import { Footer, Header, Loader } from './components/Chrome'
import VoucherShop from './components/VoucherShop'
import { BOOKING_URL, reviews, serviceImages, services } from './data'
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

const mobileGalleryImage = [
  '/foto-store-4.webp',
  599,
  800,
  'FEM Beauty Salon Eingangsbereich — Ramperstorffergasse 51, Wien 1050',
]

function Gallery({ openImage }) {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const visibleImages = isMobile ? [...galleryImages, mobileGalleryImage] : galleryImages

  return (
    <section className="gallery" aria-label="Einblicke in den Salon">
      <div className="gallery-track">
        {[0, 1].map((copyIndex) => (
          <div className="gallery-group" aria-hidden={copyIndex === 1} key={copyIndex}>
            {visibleImages.map(([src, width, height, alt]) => (
              <button
                type="button"
                className="gallery-item"
                aria-label={`Foto vergrößern: ${alt}`}
                tabIndex={copyIndex === 1 ? -1 : 0}
                onClick={() => openImage(src)}
                key={`${copyIndex}-${src}`}
              >
                <img
                  src={src}
                  width={width}
                  height={height}
                  alt={copyIndex === 0 ? alt : ''}
                  loading="eager"
                  decoding="async"
                />
              </button>
            ))}
          </div>
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

function ServiceGlyph({ serviceId }) {
  const commonProps = {
    width: '1em',
    height: '1em',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.45',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }

  if (serviceId === 'face') {
    return (
      <svg {...commonProps}>
        <path d="M15.8 4.1c-4.8-.9-8.9 2.4-8.9 7.6 0 4.4 2.7 7.2 6.8 8.2" />
        <path d="M15.8 4.1c-1.7 1.8-2.2 3.8-1.5 5.8.4 1.2 1.6 1.8 2.7 2.3-.7.9-1.7 1.5-2.9 1.7M11.1 10.4h.1M11.6 16.5c1 .7 2.1.9 3.2.5" />
      </svg>
    )
  }

  if (serviceId === 'headspa') {
    return (
      <svg {...commonProps}>
        <path d="M4 8.2c2.3-2.1 4.7-2.1 7 0s4.7 2.1 7 0M3.5 12.2c2.6-2.1 5.1-2.1 7.7 0s5.1 2.1 7.7 0M5 16.2c2-1.7 4-1.7 6 0s4 1.7 6 0" />
      </svg>
    )
  }

  if (serviceId === 'nails') {
    return (
      <svg {...commonProps}>
        <path d="M9 3.5h6v4H9zM8 8h8l1.2 12H6.8L8 8Z" />
        <path d="M10.2 12.2c1.2-.8 2.4-.8 3.6 0" />
      </svg>
    )
  }

  if (serviceId === 'waxing') {
    return (
      <svg {...commonProps}>
        <path d="M12 3.2S6.8 9.1 6.8 13.5a5.2 5.2 0 0 0 10.4 0C17.2 9.1 12 3.2 12 3.2Z" />
        <path d="M9.5 14.4c.4 1 1.3 1.7 2.5 1.9" />
      </svg>
    )
  }

  if (serviceId === 'laser') {
    return (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="3.2" />
        <path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1" />
      </svg>
    )
  }

  if (serviceId === 'lash') {
    return (
      <svg {...commonProps}>
        <path d="M3.3 12s3.1-4.6 8.7-4.6 8.7 4.6 8.7 4.6-3.1 4.6-8.7 4.6S3.3 12 3.3 12Z" />
        <circle cx="12" cy="12" r="2.4" />
        <path d="M6.1 7.4 4.9 5.6M9.8 6.4 9.4 4.2M13.9 6.4l.4-2.2M17.6 7.5l1.3-1.8" />
      </svg>
    )
  }

  return (
    <svg {...commonProps}>
      <path d="M12 3.2c.7 4.1 2.7 6.1 6.8 6.8-4.1.7-6.1 2.7-6.8 6.8-.7-4.1-2.7-6.1-6.8-6.8 4.1-.7 6.1-2.7 6.8-6.8Z" />
      <path d="M18.2 15.3c.3 1.7 1.1 2.5 2.8 2.8-1.7.3-2.5 1.1-2.8 2.8-.3-1.7-1.1-2.5-2.8-2.8 1.7-.3 2.5-1.1 2.8-2.8Z" />
    </svg>
  )
}

function ServiceCard({ service, onSelect }) {
  return (
    <button
      type="button"
      className="srv-card"
      data-srv={service.id}
      aria-haspopup="dialog"
      aria-label={`${service.title}: Details öffnen`}
      onClick={() => onSelect(service)}
    >
      <div className="srv-card-front">
        <span className="srv-num">{service.number}</span>
        <span className="srv-icon" aria-hidden="true">+</span>
        <h3>{service.title}</h3>
        <span className="srv-hint">Mehr erfahren <i aria-hidden="true">→</i></span>
      </div>
    </button>
  )
}

function ServiceRow({ service, index, onSelect }) {
  return (
    <button
      type="button"
      className="srv-row rv"
      style={{ transitionDelay: `${index * 0.06}s` }}
      data-srv={service.id}
      aria-haspopup="dialog"
      aria-label={`${service.title}: Details öffnen`}
      onClick={() => onSelect(service)}
    >
      <span className="srv-row-num">{service.number}</span>
      <span className="srv-row-main">
        <span className="srv-row-title-line">
          <h3>{service.title}</h3>
          {service.placeholder && <span className="srv-row-badge">Demnächst</span>}
        </span>
        <span className="srv-row-tags">{service.tags.join(' · ')}</span>
      </span>
      <span className="srv-row-glyph" aria-hidden="true"><ServiceGlyph serviceId={service.id} /></span>
      <span className="srv-row-cta">
        <span className="srv-row-cta-label">Mehr erfahren</span>
        <i aria-hidden="true">→</i>
      </span>
    </button>
  )
}

// The rows mount and unmount with the desktop breakpoint, so they need their own
// observer — the global one in useRevealAnimations only collects .rv elements once.
function ServiceRows({ items, onSelect }) {
  const listRef = useRef(null)

  useEffect(() => {
    const list = listRef.current
    if (!list) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('on')
          observer.unobserve(entry.target)
        })
      },
      { threshold: 0.15 },
    )

    list.querySelectorAll('.srv-row').forEach((row) => observer.observe(row))
    return () => observer.disconnect()
  }, [items])

  return (
    <div className="srv-rows" ref={listRef}>
      {items.map((service, index) => (
        <ServiceRow key={service.id} service={service} index={index} onSelect={onSelect} />
      ))}
    </div>
  )
}

function ServiceModal({ service, onClose }) {
  const closeButtonRef = useRef(null)
  useBodyLock(Boolean(service))

  useEffect(() => {
    if (!service) return undefined

    const previouslyFocused = document.activeElement
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', closeOnEscape)
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus())

    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      window.cancelAnimationFrame(focusFrame)
      previouslyFocused?.focus?.()
    }
  }, [service, onClose])

  if (!service) return null

  const titleId = `service-modal-${service.id}`

  return (
    <div
      className="srv-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="srv-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <button ref={closeButtonRef} type="button" className="srv-modal-close" aria-label="Schließen" onClick={onClose}>×</button>
        <div className="srv-modal-visual">
          {serviceImages[service.id] && (
            <img
              className="srv-modal-photo"
              src={serviceImages[service.id]}
              alt=""
              loading="lazy"
              decoding="async"
            />
          )}
          <span className="srv-modal-kicker">FEM Service · {service.number}</span>
          <span className="srv-modal-glyph"><ServiceGlyph serviceId={service.id} /></span>
          <span className="srv-modal-number" aria-hidden="true">{service.number}</span>
          <div className="srv-modal-title-wrap">
            <span>FEM Beauty Wien</span>
            <h2 id={titleId}>{service.expandedTitle || service.title}</h2>
          </div>
        </div>
        <div className="srv-modal-content">
          <span className="tag">Behandlung im Überblick</span>
          {service.summary ? (
            <>
              <p className="srv-modal-lead">{service.summary}</p>
              <div className="srv-modal-rule" />
              <p className="srv-modal-description">{service.description}</p>
            </>
          ) : (
            <p className="srv-modal-lead">{service.description}</p>
          )}
          <div className="srv-modal-tags">{service.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
          <div className="srv-modal-actions">
            {service.placeholder ? (
              <span className="srv-modal-pending">In Vorbereitung</span>
            ) : (
              <BookingLink className="btn-p srv-modal-cta">Termin buchen</BookingLink>
            )}
            <span className="srv-modal-note">Persönliche Beratung inklusive</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Platzhalter bleiben vorerst ausgeblendet. Die Zeilen-Ansicht könnte sie tragen —
// ServiceRow rendert dafür ein "Demnächst"-Badge — nur fehlt dem 07er-Slot noch
// der echte Name. Sobald der steht: placeholder-Flag in data.js entfernen, oder
// hier auf `services` wechseln, um den Slot vorab anzuteasern.
const visibleServices = services.filter((service) => !service.placeholder)

function Services() {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [selectedService, setSelectedService] = useState(null)
  const [current, setCurrent] = useState(0)
  const closeModal = useCallback(() => setSelectedService(null), [])

  const previous = useCallback(() => {
    setCurrent((index) => (index - 1 + visibleServices.length) % visibleServices.length)
  }, [])
  const next = useCallback(() => {
    setCurrent((index) => (index + 1) % visibleServices.length)
  }, [])
  const swipeHandlers = useSwipe(previous, next)

  return (
    <>
      <section className="services" id="treatments">
        <div className="services-inner">
          <div className="services-head rv">
            <span className="tag">Behandlungen</span>
            <h2>Unsere <em>Services.</em></h2>
            <p className="services-sub">Wähle eine Behandlung und entdecke alle Details.</p>
          </div>

          {isMobile ? (
            <>
              <div className="srv-grid" {...swipeHandlers}>
                <div className="slider-track" style={{ transform: `translateX(-${current * 100}%)` }}>
                  {visibleServices.map((service) => (
                    <ServiceCard
                      key={service.id}
                      service={service}
                      onSelect={setSelectedService}
                    />
                  ))}
                </div>
              </div>

              <div className="srv-mobile-nav">
                <div className="mob-dots srv-dots">
                  {visibleServices.map((service, index) => (
                    <button
                      type="button"
                      className={`mob-dot${index === current ? ' active' : ''}`}
                      aria-label={`${service.title} anzeigen`}
                      key={service.id}
                      onClick={() => setCurrent(index)}
                    />
                  ))}
                </div>
                <p className="mob-counter srv-counter">{current + 1} / {visibleServices.length}</p>
                <p className="mob-swipe-hint">← Wischen für mehr →</p>
              </div>
            </>
          ) : (
            <ServiceRows items={visibleServices} onSelect={setSelectedService} />
          )}

          <div className="services-cta"><BookingLink className="link-arrow">Alle Preise auf Treatwell →</BookingLink></div>
        </div>
      </section>
      <ServiceModal service={selectedService} onClose={closeModal} />
    </>
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

function Reviews() {
  const [filter, setFilter] = useState(null)

  const filtered = filter ? reviews.filter((review) => review.platform === filter) : reviews

  const toggleFilter = (platform) => {
    setFilter((active) => (active === platform ? null : platform))
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

        <div className="reviews-flow" aria-label="Automatisch fließende Kundenbewertungen">
          <div
            className="reviews-flow-track"
            key={filter || 'all'}
            style={{ '--reviews-flow-duration': `${Math.max(80, filtered.length * 8)}s` }}
          >
            {[0, 1].map((copyIndex) => (
              <div className="reviews-flow-group" aria-hidden={copyIndex === 1} key={copyIndex}>
                {filtered.map((review, reviewIndex) => (
                  <ReviewCard
                    review={review}
                    interactive={copyIndex === 0}
                    key={`${copyIndex}-${review.name}-${reviewIndex}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
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
        <Services />
        <Stats />
        <Reviews />
        <VoucherShop />
        <Owner />
        <Contact />
      </main>
      <Lightbox image={lightboxImage} onClose={closeLightbox} />
      <Faq />
      <Footer />
    </>
  )
}
