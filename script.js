document.addEventListener('DOMContentLoaded', function () {

    var isMobile = function () { return window.innerWidth <= 768; };
    var hasGSAP = typeof gsap !== 'undefined';

    /* ─── Loader ────────────────────────────── */
    setTimeout(function () {
        var l = document.getElementById('loader');
        if (!l) return;
        l.classList.add('done');
        setTimeout(function () { l.style.display = 'none'; }, 1200);
    }, 2400);

    /* ─── Sticky nav ────────────────────────── */
    var nav = document.getElementById('nav');
    window.addEventListener('scroll', function () {
        nav.classList.toggle('scrolled', window.scrollY > 60);
    });

    /* ─── Scroll Progress ───────────────────── */
    var prog = document.getElementById('scrollProgress');
    window.addEventListener('scroll', function () {
        var h = document.documentElement.scrollHeight - window.innerHeight;
        if (h > 0) prog.style.width = (window.scrollY / h * 100) + '%';
    }, { passive: true });

    /* ─── Mobile menu ───────────────────────── */
    var burger = document.getElementById('burger');
    var mobMenu = document.getElementById('mobileMenu');
    if (burger && mobMenu) {
        burger.addEventListener('click', function () {
            burger.classList.toggle('open');
            mobMenu.classList.toggle('open');
            document.body.style.overflow = mobMenu.classList.contains('open') ? 'hidden' : '';
        });
        mobMenu.querySelectorAll('a').forEach(function (a) {
            a.addEventListener('click', function () {
                burger.classList.remove('open');
                mobMenu.classList.remove('open');
                document.body.style.overflow = '';
            });
        });
    }

    /* ─── Basic reveals ─────────────────────── */
    var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) e.target.classList.add('on'); });
    }, { threshold: 0.06, rootMargin: '0px 0px -30px 0px' });
    document.querySelectorAll('.rv').forEach(function (el) { obs.observe(el); });

    var lineObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('on'); lineObs.unobserve(e.target); } });
    }, { threshold: 0.3 });
    document.querySelectorAll('.anim-line').forEach(function (el) { lineObs.observe(el); });

    var storyObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('revealed'); storyObs.unobserve(e.target); } });
    }, { threshold: 0.15 });
    document.querySelectorAll('.story-img').forEach(function (el) { storyObs.observe(el); });


    /* ═══════════════════════════════════════════
       SERVICE CARDS — expand/collapse
       ═══════════════════════════════════════════ */
    document.querySelectorAll('.srv-card').forEach(function (card) {
        card.addEventListener('click', function (e) {
            if (e.target.classList.contains('srv-close')) { card.classList.remove('open'); recalcSrvHeight(); return; }
            if (e.target.tagName === 'A' || e.target.closest('a')) return;
            document.querySelectorAll('.srv-card.open').forEach(function (c) { if (c !== card) c.classList.remove('open'); });
            card.classList.toggle('open');
            recalcSrvHeight();
        });
    });
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.srv-card')) {
            document.querySelectorAll('.srv-card.open').forEach(function (c) { c.classList.remove('open'); });
            recalcSrvHeight();
        }
    });

    function recalcSrvHeight() {
        // Delay to let CSS transition complete
        setTimeout(function () {
            if (srvCarousel) srvCarousel._setHeight();
        }, 60);
    }


    /* ═══════════════════════════════════════════
       TEAM CARDS — expand/collapse
       ═══════════════════════════════════════════ */
    document.querySelectorAll('.tm-card').forEach(function (card) {
        card.addEventListener('click', function (e) {
            if (e.target.classList.contains('tm-close')) { card.classList.remove('open'); return; }
            if (e.target.tagName === 'A' || e.target.closest('a')) return;
            document.querySelectorAll('.tm-card.open').forEach(function (c) { if (c !== card) c.classList.remove('open'); });
            card.classList.toggle('open');
        });
    });
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.tm-card')) document.querySelectorAll('.tm-card.open').forEach(function (c) { c.classList.remove('open'); });
    });


    /* ═══════════════════════════════════════════════════════════
       GSAP CAROUSEL ENGINE
       Reusable for both services & reviews
       ═══════════════════════════════════════════════════════════ */
    function GsapCarousel(cfg) {
        this.container = cfg.container;
        this.items = cfg.items;
        this.dotsContainer = cfg.dotsContainer;
        this.counterEl = cfg.counterEl;
        this.autoPlay = cfg.autoPlay || 0;
        this.current = 0;
        this.total = this.items.length;
        this.busy = false;
        this.timer = null;
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchDeltaX = 0;
        this.dragging = false;
        this.threshold = 50;

        this._init();
    }

    GsapCarousel.prototype._init = function () {
        var self = this;
        if (!this.container || this.total === 0) return;

        // Set initial state: first item active, rest hidden
        this.items.forEach(function (item, i) {
            item.classList.remove('carousel-active', 'carousel-prev', 'carousel-next');
            if (i === 0) {
                item.classList.add('carousel-active');
                gsap.set(item, { opacity: 1, x: 0, scale: 1 });
            } else {
                gsap.set(item, { opacity: 0, x: 80, scale: 0.92 });
            }
        });

        this._setHeight();
        this._buildDots();
        this._updateCounter();
        this._bindTouch();
        if (this.autoPlay > 0) this._startAuto();
    };

    GsapCarousel.prototype._setHeight = function () {
        // Measure the active card's natural height and set it on the container
        var active = this.items[this.current];
        if (!active || !this.container) return;
        // Temporarily make it visible to measure
        var h = active.scrollHeight;
        this.container.style.height = h + 'px';
        this.container.style.transition = 'height .4s cubic-bezier(.19,1,.22,1)';
    };

    GsapCarousel.prototype._buildDots = function () {
        var self = this;
        if (!this.dotsContainer) return;
        this.dotsContainer.innerHTML = '';
        for (var i = 0; i < this.total; i++) {
            var dot = document.createElement('button');
            dot.className = 'mob-dot' + (i === 0 ? ' active' : '');
            dot.setAttribute('data-idx', i);
            (function (idx) {
                dot.addEventListener('click', function () {
                    self.goTo(idx);
                    if (self.autoPlay > 0) self._startAuto();
                });
            })(i);
            this.dotsContainer.appendChild(dot);
        }
    };

    GsapCarousel.prototype._updateDots = function () {
        if (!this.dotsContainer) return;
        var self = this;
        this.dotsContainer.querySelectorAll('.mob-dot').forEach(function (d, i) {
            d.classList.toggle('active', i === self.current);
        });
    };

    GsapCarousel.prototype._updateCounter = function () {
        if (this.counterEl) this.counterEl.textContent = (this.current + 1) + ' / ' + this.total;
    };

    GsapCarousel.prototype.goTo = function (idx, direction) {
        if (this.busy || idx === this.current || idx < 0 || idx >= this.total) return;
        this.busy = true;
        var self = this;
        var prev = this.current;
        var dir = direction || (idx > prev ? 1 : -1);
        var prevItem = this.items[prev];
        var nextItem = this.items[idx];

        // Pre-measure incoming card height and animate container
        var nextH = nextItem.scrollHeight;
        this.container.style.height = nextH + 'px';

        // Animate out
        gsap.to(prevItem, {
            x: dir * -100, opacity: 0, scale: 0.92,
            duration: 0.55, ease: 'power3.inOut',
            onComplete: function () {
                prevItem.classList.remove('carousel-active');
            }
        });

        // Animate in
        gsap.fromTo(nextItem,
            { x: dir * 100, opacity: 0, scale: 0.92 },
            {
                x: 0, opacity: 1, scale: 1,
                duration: 0.55, ease: 'power3.inOut',
                delay: 0.05,
                onStart: function () {
                    nextItem.classList.add('carousel-active');
                },
                onComplete: function () {
                    self.current = idx;
                    self.busy = false;
                    self._updateDots();
                    self._updateCounter();
                }
            }
        );
    };

    GsapCarousel.prototype.next = function () {
        this.goTo((this.current + 1) % this.total, 1);
    };

    GsapCarousel.prototype.prev = function () {
        this.goTo((this.current - 1 + this.total) % this.total, -1);
    };

    GsapCarousel.prototype._bindTouch = function () {
        var self = this;
        var el = this.container;

        el.addEventListener('touchstart', function (e) {
            if (self.busy) return;
            self.touchStartX = e.touches[0].clientX;
            self.touchStartY = e.touches[0].clientY;
            self.touchDeltaX = 0;
            self.dragging = true;

            // Live drag: slightly shift active card
            var active = self.items[self.current];
            if (active) gsap.killTweensOf(active);
        }, { passive: true });

        el.addEventListener('touchmove', function (e) {
            if (!self.dragging) return;
            self.touchDeltaX = e.touches[0].clientX - self.touchStartX;
            var deltaY = Math.abs(e.touches[0].clientY - self.touchStartY);

            // If scrolling more vertically, abort drag
            if (deltaY > Math.abs(self.touchDeltaX) * 1.5) {
                self.dragging = false;
                gsap.to(self.items[self.current], { x: 0, scale: 1, duration: 0.3, ease: 'power2.out' });
                return;
            }

            // Live drag feedback — subtle shift + scale
            var active = self.items[self.current];
            var progress = Math.max(-1, Math.min(1, self.touchDeltaX / el.offsetWidth));
            gsap.set(active, {
                x: self.touchDeltaX * 0.4,
                scale: 1 - Math.abs(progress) * 0.04
            });
        }, { passive: true });

        el.addEventListener('touchend', function () {
            if (!self.dragging) return;
            self.dragging = false;

            if (Math.abs(self.touchDeltaX) > self.threshold) {
                if (self.touchDeltaX < 0) self.next();
                else self.prev();
            } else {
                // Snap back with spring
                gsap.to(self.items[self.current], {
                    x: 0, scale: 1,
                    duration: 0.5, ease: 'elastic.out(1, 0.75)'
                });
            }

            if (self.autoPlay > 0) self._startAuto();
        }, { passive: true });
    };

    GsapCarousel.prototype._startAuto = function () {
        var self = this;
        clearInterval(this.timer);
        this.timer = setInterval(function () { self.next(); }, this.autoPlay);
    };

    GsapCarousel.prototype.destroy = function () {
        clearInterval(this.timer);
        this.container.style.height = '';
        this.container.style.transition = '';
        this.items.forEach(function (item) {
            item.classList.remove('carousel-active', 'carousel-prev', 'carousel-next');
            gsap.set(item, { clearProps: 'all' });
        });
    };


    /* ═══════════════════════════════════════════
       SERVICES — Mobile carousel instance
       ═══════════════════════════════════════════ */
    var srvCarousel = null;

    function initServicesMobile() {
        if (!isMobile() || !hasGSAP) return;
        if (srvCarousel) return; // already init

        var grid = document.querySelector('.srv-grid');
        var cards = Array.from(document.querySelectorAll('.srv-card'));
        var dots = document.querySelector('.srv-dots');
        var counter = document.querySelector('.srv-counter');

        if (!grid || cards.length === 0) return;
        srvCarousel = new GsapCarousel({
            container: grid,
            items: cards,
            dotsContainer: dots,
            counterEl: counter,
            autoPlay: 0
        });
    }

    function destroyServicesMobile() {
        if (srvCarousel) { srvCarousel.destroy(); srvCarousel = null; }
    }


    /* ═══════════════════════════════════════════
       REVIEWS — Desktop set carousel (improved)
       ═══════════════════════════════════════════ */
    var sets = document.querySelectorAll('.reviews-set');
    var dots = document.querySelectorAll('.reviews-dot');
    var currentSet = 0;
    var reviewTimer;

    function showSet(idx) {
        if (idx === currentSet) return;
        var prev = sets[currentSet];
        var next = sets[idx];

        // Exit animation
        prev.classList.remove('active');
        prev.classList.add('exiting');

        // After exit transition, remove class
        setTimeout(function () { prev.classList.remove('exiting'); }, 700);

        // Enter
        next.classList.add('active');

        currentSet = idx;
        dots.forEach(function (d, i) { d.classList.toggle('active', i === idx); });
    }

    function nextDesktopSet() { showSet((currentSet + 1) % sets.length); }

    function startDesktopAutoRotate() {
        clearInterval(reviewTimer);
        if (!isMobile()) reviewTimer = setInterval(nextDesktopSet, 5000);
    }

    dots.forEach(function (dot) {
        dot.addEventListener('click', function () {
            showSet(parseInt(this.getAttribute('data-set')));
            startDesktopAutoRotate();
        });
    });

    if (!isMobile()) startDesktopAutoRotate();


    /* ═══════════════════════════════════════════
       REVIEWS — Mobile carousel instance
       ═══════════════════════════════════════════ */
    var mobReviewsTrack = document.getElementById('mobReviewsTrack');
    var reviewMobDots = document.querySelector('.review-mob-dots');
    var reviewCardHTMLs = [];
    var reviewCarousel = null;

    // Collect all review card HTML once
    sets.forEach(function (set) {
        set.querySelectorAll('.review-card').forEach(function (card) {
            reviewCardHTMLs.push(card.outerHTML);
        });
    });

    function initReviewsMobile() {
        if (!isMobile() || !hasGSAP || !mobReviewsTrack) return;
        if (reviewCarousel) return; // already init

        // Populate track
        mobReviewsTrack.innerHTML = reviewCardHTMLs.join('');
        var cards = Array.from(mobReviewsTrack.querySelectorAll('.review-card'));

        reviewCarousel = new GsapCarousel({
            container: mobReviewsTrack,
            items: cards,
            dotsContainer: reviewMobDots,
            autoPlay: 4500
        });
    }

    function destroyReviewsMobile() {
        if (reviewCarousel) { reviewCarousel.destroy(); reviewCarousel = null; }
        if (mobReviewsTrack) mobReviewsTrack.innerHTML = '';
        if (reviewMobDots) reviewMobDots.innerHTML = '';
    }


    /* ─── Init + resize ─────────────────────── */
    if (isMobile()) {
        initServicesMobile();
        initReviewsMobile();
    }

    var resizeTimeout;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(function () {
            if (isMobile()) {
                initServicesMobile();
                initReviewsMobile();
                clearInterval(reviewTimer);
                // Recalc heights after orientation change etc
                if (srvCarousel) srvCarousel._setHeight();
                if (reviewCarousel) reviewCarousel._setHeight();
            } else {
                destroyServicesMobile();
                destroyReviewsMobile();
                startDesktopAutoRotate();
            }
        }, 250);
    });


    /* ═══════════════════════════════════════════
       COUNTER ANIMATION
       ═══════════════════════════════════════════ */
    var counterDone = false;
    var statsObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
            if (e.isIntersecting && !counterDone) {
                counterDone = true;
                animateCounters();
                statsObs.disconnect();
            }
        });
    }, { threshold: 0.3 });
    var statsSection = document.querySelector('.stats-strip');
    if (statsSection) statsObs.observe(statsSection);

    function animateCounters() {
        document.querySelectorAll('.stat-num[data-count]').forEach(function (el) {
            var target = parseFloat(el.getAttribute('data-count'));
            var isDecimal = el.hasAttribute('data-decimal');
            var duration = 2000, start = performance.now();
            function ease(t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }
            function step(now) {
                var p = Math.min((now - start) / duration, 1), val = ease(p) * target;
                el.textContent = isDecimal ? val.toFixed(1) : Math.floor(val);
                if (p < 1) requestAnimationFrame(step);
                else el.textContent = isDecimal ? target.toFixed(1) : Math.round(target);
            }
            requestAnimationFrame(step);
        });
    }


    /* ═══════════════════════════════════════════
       GSAP CINEMATIC SCROLL
       ═══════════════════════════════════════════ */
    if (hasGSAP && typeof ScrollTrigger !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);

        gsap.to('.hero-bg img', {
            y: 150, scale: 1.1, ease: 'none',
            scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
        });
        gsap.to('.hero-content', {
            y: -60, opacity: 0, ease: 'none',
            scrollTrigger: { trigger: '.hero', start: '60% top', end: 'bottom top', scrub: true }
        });
        gsap.to('.hero-scroll', {
            opacity: 0, ease: 'none',
            scrollTrigger: { trigger: '.hero', start: '20% top', end: '40% top', scrub: true }
        });

        gsap.utils.toArray('.usp-strip-item').forEach(function (item, i) {
            gsap.fromTo(item, { x: -40, opacity: 0 },
                {
                    x: 0, opacity: 1, duration: 1, delay: i * 0.15, ease: 'expo.out',
                    scrollTrigger: { trigger: '.usp-strip', start: 'top 85%', toggleActions: 'play none none none' }
                });
        });

        gsap.to('.story-img img', {
            y: -80, ease: 'none',
            scrollTrigger: { trigger: '.story', start: 'top bottom', end: 'bottom top', scrub: 1.5 }
        });

        gsap.utils.toArray('.srv-card').forEach(function (card, i) {
            gsap.fromTo(card, { y: 60, opacity: 0 },
                {
                    y: 0, opacity: 1, duration: 1, delay: i * 0.1, ease: 'expo.out',
                    scrollTrigger: { trigger: '.srv-grid', start: 'top 80%', toggleActions: 'play none none none' }
                });
        });

        gsap.fromTo('.reviews-carousel', { y: 40, opacity: 0 },
            {
                y: 0, opacity: 1, duration: 1.2, ease: 'expo.out',
                scrollTrigger: { trigger: '.reviews', start: 'top 75%', toggleActions: 'play none none none' }
            });

        if (mobReviewsTrack) {
            gsap.fromTo(mobReviewsTrack, { y: 40, opacity: 0 },
                {
                    y: 0, opacity: 1, duration: 1.2, ease: 'expo.out',
                    scrollTrigger: { trigger: '.reviews', start: 'top 75%', toggleActions: 'play none none none' }
                });
        }

        gsap.utils.toArray('.tm-card').forEach(function (card, i) {
            gsap.fromTo(card, { y: 50, opacity: 0, rotation: i % 2 === 0 ? -2 : 2 },
                {
                    y: 0, opacity: 1, rotation: 0, duration: 0.9, delay: i * 0.07, ease: 'expo.out',
                    scrollTrigger: { trigger: '.team-grid', start: 'top 80%', toggleActions: 'play none none none' }
                });
        });

        gsap.utils.toArray('.stat-item').forEach(function (item, i) {
            gsap.fromTo(item, { scale: 0.8, opacity: 0 },
                {
                    scale: 1, opacity: 1, duration: 0.8, delay: i * 0.12, ease: 'expo.out',
                    scrollTrigger: { trigger: '.stats-strip', start: 'top 80%', toggleActions: 'play none none none' }
                });
        });

        gsap.fromTo('.contact-info', { x: -80, opacity: 0 },
            {
                x: 0, opacity: 1, duration: 1.4, ease: 'expo.out',
                scrollTrigger: { trigger: '.contact', start: 'top 70%', toggleActions: 'play none none none' }
            });
        gsap.fromTo('.contact-map', { x: 80, opacity: 0 },
            {
                x: 0, opacity: 1, duration: 1.4, ease: 'expo.out',
                scrollTrigger: { trigger: '.contact', start: 'top 70%', toggleActions: 'play none none none' }
            });

        var mTrack = document.querySelector('.brands-marquee-track');
        if (mTrack) {
            ScrollTrigger.create({
                trigger: '.brands-marquee', start: 'top bottom', end: 'bottom top',
                onUpdate: function (self) { mTrack.style.animationDuration = (25 - self.progress * 14) + 's'; }
            });
        }

        gsap.fromTo('footer', { y: 30, opacity: 0 },
            {
                y: 0, opacity: 1, duration: 1, ease: 'expo.out',
                scrollTrigger: { trigger: 'footer', start: 'top 90%', toggleActions: 'play none none none' }
            });

        document.querySelectorAll('.services-head, .reviews-head, .team-top').forEach(function (el) {
            gsap.fromTo(el, { y: 30, opacity: 0 },
                {
                    y: 0, opacity: 1, duration: 1.1, ease: 'expo.out',
                    scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none none' }
                });
        });
    }

    /* ─── Smooth scroll ─────────────────────── */
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
        link.addEventListener('click', function (e) {
            var t = document.querySelector(this.getAttribute('href'));
            if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        });
    });

    /* ─── 3D tilt on review cards (desktop) ─── */
    if (!isMobile()) {
        document.querySelectorAll('.review-card').forEach(function (card) {
            card.addEventListener('mousemove', function (e) {
                var r = card.getBoundingClientRect();
                var rx = (e.clientY - r.top - r.height / 2) / (r.height / 2) * -2;
                var ry = (e.clientX - r.left - r.width / 2) / (r.width / 2) * 2;
                card.style.transform = 'translateY(-6px) perspective(600px) rotateX(' + rx + 'deg) rotateY(' + ry + 'deg)';
            });
            card.addEventListener('mouseleave', function () { card.style.transform = ''; });
        });
    }
});