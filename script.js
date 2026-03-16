document.addEventListener('DOMContentLoaded', function () {

    var isMob = function () { return window.innerWidth <= 768; };
    var hasGSAP = typeof gsap !== 'undefined';

    /* ─── Loader ────────────────────────────── */
    setTimeout(function () {
        var l = document.getElementById('loader');
        if (!l) return;
        l.classList.add('done');
        setTimeout(function () { l.style.display = 'none'; }, 1200);
    }, 2400);

    /* ─── Nav ───────────────────────────────── */
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

    /* ─── Reveals ───────────────────────────── */
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


    /* ═══ Expand/Collapse — Services ═════════ */
    document.querySelectorAll('.srv-card').forEach(function (card) {
        card.addEventListener('click', function (e) {
            if (e.target.classList.contains('srv-close')) { card.classList.remove('open'); return; }
            if (e.target.tagName === 'A' || e.target.closest('a')) return;
            document.querySelectorAll('.srv-card.open').forEach(function (c) { if (c !== card) c.classList.remove('open'); });
            card.classList.toggle('open');
        });
    });
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.srv-card')) document.querySelectorAll('.srv-card.open').forEach(function (c) { c.classList.remove('open'); });
    });

    /* ═══ Expand/Collapse — Team ════════════ */
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


    /* ═══════════════════════════════════════════
       FLEX SLIDER — clean, no teleport
       Cards sit in a flex row inside .slider-track.
       We translateX the track to slide.
       ═══════════════════════════════════════════ */
    function FlexSlider(cfg) {
        this.container = cfg.container;   // the overflow:hidden wrapper
        this.cards = cfg.cards;           // NodeList or array of card elements
        this.dotsEl = cfg.dots || null;
        this.counterEl = cfg.counter || null;
        this.auto = cfg.auto || 0;       // ms, 0 = off
        this.current = 0;
        this.total = this.cards.length;
        this.track = null;
        this.timer = null;
        this.touchX0 = 0;
        this.touchY0 = 0;
        this.dx = 0;
        this.dragging = false;

        if (this.total > 0) this._build();
    }

    FlexSlider.prototype._build = function () {
        // Wrap cards in a slider-track div
        this.track = document.createElement('div');
        this.track.className = 'slider-track';
        // Move cards into track
        var frag = document.createDocumentFragment();
        for (var i = 0; i < this.total; i++) frag.appendChild(this.cards[i]);
        this.track.appendChild(frag);
        this.container.appendChild(this.track);

        this._dots();
        this._counter();
        this._touch();
        if (this.auto > 0) this._startAuto();
    };

    FlexSlider.prototype.goTo = function (idx) {
        if (idx < 0 || idx >= this.total) return;
        this.current = idx;
        this.track.style.transform = 'translateX(-' + (idx * 100) + '%)';
        this._dots();
        this._counter();
    };

    FlexSlider.prototype.next = function () { this.goTo((this.current + 1) % this.total); };
    FlexSlider.prototype.prev = function () { this.goTo((this.current - 1 + this.total) % this.total); };

    FlexSlider.prototype._dots = function () {
        if (!this.dotsEl) return;
        // Build once
        if (this.dotsEl.children.length !== this.total) {
            this.dotsEl.innerHTML = '';
            var self = this;
            for (var i = 0; i < this.total; i++) {
                var d = document.createElement('button');
                d.className = 'mob-dot';
                d.setAttribute('data-i', i);
                (function (idx) {
                    d.addEventListener('click', function () {
                        self.goTo(idx);
                        if (self.auto > 0) self._startAuto();
                    });
                })(i);
                this.dotsEl.appendChild(d);
            }
        }
        this.dotsEl.querySelectorAll('.mob-dot').forEach(function (d, i) {
            d.classList.toggle('active', i === this.current);
        }.bind(this));
    };

    FlexSlider.prototype._counter = function () {
        if (this.counterEl) this.counterEl.textContent = (this.current + 1) + ' / ' + this.total;
    };

    FlexSlider.prototype._touch = function () {
        var self = this;

        this.container.addEventListener('touchstart', function (e) {
            self.touchX0 = e.touches[0].clientX;
            self.touchY0 = e.touches[0].clientY;
            self.dx = 0;
            self.dragging = true;
            // Disable CSS transition during drag
            self.track.style.transition = 'none';
        }, { passive: true });

        this.container.addEventListener('touchmove', function (e) {
            if (!self.dragging) return;
            self.dx = e.touches[0].clientX - self.touchX0;
            var dy = Math.abs(e.touches[0].clientY - self.touchY0);
            // If scrolling vertically, abort
            if (dy > Math.abs(self.dx) * 1.2) { self.dragging = false; self._snapBack(); return; }
            // Live drag — move track with finger
            var base = -(self.current * 100);
            var pxOffset = self.dx;
            var pctOffset = (pxOffset / self.container.offsetWidth) * 100;
            self.track.style.transform = 'translateX(' + (base + pctOffset) + '%)';
        }, { passive: true });

        this.container.addEventListener('touchend', function () {
            if (!self.dragging) return;
            self.dragging = false;
            // Re-enable transition
            self.track.style.transition = '';
            var threshold = self.container.offsetWidth * 0.2;
            if (self.dx < -threshold && self.current < self.total - 1) {
                self.goTo(self.current + 1);
            } else if (self.dx > threshold && self.current > 0) {
                self.goTo(self.current - 1);
            } else {
                self._snapBack();
            }
            if (self.auto > 0) self._startAuto();
        }, { passive: true });
    };

    FlexSlider.prototype._snapBack = function () {
        this.track.style.transition = '';
        this.track.style.transform = 'translateX(-' + (this.current * 100) + '%)';
    };

    FlexSlider.prototype._startAuto = function () {
        var self = this;
        clearInterval(this.timer);
        this.timer = setInterval(function () { self.next(); }, this.auto);
    };

    FlexSlider.prototype.destroy = function () {
        clearInterval(this.timer);
        // Unwrap: move cards back out of track
        if (this.track && this.track.parentNode) {
            while (this.track.firstChild) this.container.appendChild(this.track.firstChild);
            this.track.remove();
        }
        this.track = null;
        if (this.dotsEl) this.dotsEl.innerHTML = '';
    };


    /* ═══ Services mobile slider ════════════ */
    var srvSlider = null;
    function initSrvMobile() {
        if (!isMob() || srvSlider) return;
        var grid = document.querySelector('.srv-grid');
        var cards = Array.from(grid.querySelectorAll('.srv-card'));
        if (!grid || !cards.length) return;
        srvSlider = new FlexSlider({
            container: grid,
            cards: cards,
            dots: document.querySelector('.srv-dots'),
            counter: document.querySelector('.srv-counter')
        });
    }
    function destroySrvMobile() { if (srvSlider) { srvSlider.destroy(); srvSlider = null; } }


    /* ═══ Desktop review sets ═══════════════ */
    var sets = document.querySelectorAll('.reviews-set');
    var desktopDots = document.querySelectorAll('.reviews-dot');
    var currentSet = 0;
    var deskTimer;

    function showSet(idx) {
        if (idx === currentSet) return;
        sets[currentSet].classList.remove('active');
        sets[currentSet].classList.add('exiting');
        setTimeout(function () { sets[currentSet === idx ? currentSet : (currentSet)]; }, 700);
        var prev = currentSet;
        sets[idx].classList.add('active');
        currentSet = idx;
        setTimeout(function () { sets[prev].classList.remove('exiting'); }, 700);
        desktopDots.forEach(function (d, i) { d.classList.toggle('active', i === idx); });
    }

    function startDeskAuto() {
        clearInterval(deskTimer);
        if (!isMob()) deskTimer = setInterval(function () {
            showSet((currentSet + 1) % sets.length);
        }, 5000);
    }

    desktopDots.forEach(function (dot) {
        dot.addEventListener('click', function () {
            showSet(parseInt(this.getAttribute('data-set')));
            startDeskAuto();
        });
    });

    if (!isMob()) startDeskAuto();


    /* ═══ Mobile review slider ═════════════ */
    var mobTrack = document.getElementById('mobReviewsTrack');
    var mobReviewDots = document.querySelector('.review-mob-dots');
    var revHTMLs = [];
    var revSlider = null;

    sets.forEach(function (s) {
        s.querySelectorAll('.review-card').forEach(function (c) { revHTMLs.push(c.outerHTML); });
    });

    function initRevMobile() {
        if (!isMob() || revSlider || !mobTrack) return;
        mobTrack.innerHTML = revHTMLs.join('');
        var cards = Array.from(mobTrack.querySelectorAll('.review-card'));
        revSlider = new FlexSlider({
            container: mobTrack,
            cards: cards,
            dots: mobReviewDots,
            auto: 4500
        });
    }
    function destroyRevMobile() {
        if (revSlider) { revSlider.destroy(); revSlider = null; }
        if (mobTrack) mobTrack.innerHTML = '';
        if (mobReviewDots) mobReviewDots.innerHTML = '';
    }


    /* ─── Init + resize ─────────────────────── */
    if (isMob()) { initSrvMobile(); initRevMobile(); }

    var rto;
    window.addEventListener('resize', function () {
        clearTimeout(rto);
        rto = setTimeout(function () {
            if (isMob()) {
                initSrvMobile();
                initRevMobile();
                clearInterval(deskTimer);
            } else {
                destroySrvMobile();
                destroyRevMobile();
                startDeskAuto();
            }
        }, 250);
    });


    /* ═══ Counter animation ═════════════════ */
    var cDone = false;
    var sObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
            if (e.isIntersecting && !cDone) { cDone = true; runCounters(); sObs.disconnect(); }
        });
    }, { threshold: 0.3 });
    var ss = document.querySelector('.stats-strip');
    if (ss) sObs.observe(ss);

    function runCounters() {
        document.querySelectorAll('.stat-num[data-count]').forEach(function (el) {
            var t = parseFloat(el.getAttribute('data-count'));
            var dec = el.hasAttribute('data-decimal');
            var dur = 2000, s = performance.now();
            function ease(x) { return x === 1 ? 1 : 1 - Math.pow(2, -10 * x); }
            function step(now) {
                var p = Math.min((now - s) / dur, 1), v = ease(p) * t;
                el.textContent = dec ? v.toFixed(1) : Math.floor(v);
                if (p < 1) requestAnimationFrame(step);
                else el.textContent = dec ? t.toFixed(1) : Math.round(t);
            }
            requestAnimationFrame(step);
        });
    }


    /* ═══ GSAP Cinematic Scroll ═════════════ */
    if (hasGSAP && typeof ScrollTrigger !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);

        // Hero depth
        gsap.to('.hero-bg img', {
            y: 150, scale: 1.1, ease: 'none',
            scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
        });
        gsap.to('.hero-content', {
            y: -80, opacity: 0, ease: 'none',
            scrollTrigger: { trigger: '.hero', start: '50% top', end: 'bottom top', scrub: true }
        });
        gsap.to('.hero-scroll', {
            opacity: 0, ease: 'none',
            scrollTrigger: { trigger: '.hero', start: '15% top', end: '35% top', scrub: true }
        });

        // USP
        gsap.utils.toArray('.usp-strip-item').forEach(function (el, i) {
            gsap.fromTo(el, { x: -40, opacity: 0 },
                {
                    x: 0, opacity: 1, duration: 1, delay: i * .15, ease: 'expo.out',
                    scrollTrigger: { trigger: '.usp-strip', start: 'top 85%', toggleActions: 'play none none none' }
                });
        });

        // Story parallax
        gsap.to('.story-img img', {
            y: -80, ease: 'none',
            scrollTrigger: { trigger: '.story', start: 'top bottom', end: 'bottom top', scrub: 1.5 }
        });

        // Gallery
        gsap.utils.toArray('.gallery-item').forEach(function (el, i) {
            gsap.fromTo(el, { y: 40, opacity: 0, scale: .95 },
                {
                    y: 0, opacity: 1, scale: 1, duration: 1, delay: i * .12, ease: 'expo.out',
                    scrollTrigger: { trigger: '.gallery', start: 'top 85%', toggleActions: 'play none none none' }
                });
        });
        gsap.utils.toArray('.gallery-item img').forEach(function (img) {
            gsap.to(img, {
                y: -30, ease: 'none',
                scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: 1.5 }
            });
        });

        // Services
        gsap.utils.toArray('.srv-card').forEach(function (c, i) {
            gsap.fromTo(c, { y: 60, opacity: 0 },
                {
                    y: 0, opacity: 1, duration: 1, delay: i * .1, ease: 'expo.out',
                    scrollTrigger: { trigger: '.srv-grid', start: 'top 80%', toggleActions: 'play none none none' }
                });
        });

        // Reviews
        gsap.fromTo('.reviews-carousel', { y: 40, opacity: 0 },
            {
                y: 0, opacity: 1, duration: 1.2, ease: 'expo.out',
                scrollTrigger: { trigger: '.reviews', start: 'top 75%', toggleActions: 'play none none none' }
            });
        if (mobTrack) {
            gsap.fromTo(mobTrack, { y: 40, opacity: 0 },
                {
                    y: 0, opacity: 1, duration: 1.2, ease: 'expo.out',
                    scrollTrigger: { trigger: '.reviews', start: 'top 75%', toggleActions: 'play none none none' }
                });
        }

        // Team
        gsap.utils.toArray('.tm-card').forEach(function (c, i) {
            gsap.fromTo(c, { y: 50, opacity: 0, rotation: i % 2 === 0 ? -2 : 2 },
                {
                    y: 0, opacity: 1, rotation: 0, duration: .9, delay: i * .07, ease: 'expo.out',
                    scrollTrigger: { trigger: '.team-grid', start: 'top 80%', toggleActions: 'play none none none' }
                });
        });

        // Stats
        gsap.utils.toArray('.stat-item').forEach(function (el, i) {
            gsap.fromTo(el, { scale: .8, opacity: 0 },
                {
                    scale: 1, opacity: 1, duration: .8, delay: i * .12, ease: 'expo.out',
                    scrollTrigger: { trigger: '.stats-strip', start: 'top 80%', toggleActions: 'play none none none' }
                });
        });

        // Contact
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

        // Marquee speed
        var mT = document.querySelector('.brands-marquee-track');
        if (mT) {
            ScrollTrigger.create({
                trigger: '.brands-marquee', start: 'top bottom', end: 'bottom top',
                onUpdate: function (s) { mT.style.animationDuration = (25 - s.progress * 14) + 's'; }
            });
        }

        // Footer
        gsap.fromTo('footer', { y: 30, opacity: 0 },
            {
                y: 0, opacity: 1, duration: 1, ease: 'expo.out',
                scrollTrigger: { trigger: 'footer', start: 'top 90%', toggleActions: 'play none none none' }
            });

        // Section heads
        document.querySelectorAll('.services-head, .reviews-head, .team-top').forEach(function (el) {
            gsap.fromTo(el, { y: 30, opacity: 0 },
                {
                    y: 0, opacity: 1, duration: 1.1, ease: 'expo.out',
                    scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none none' }
                });
        });
    }

    /* ─── Smooth scroll ─────────────────────── */
    document.querySelectorAll('a[href^="#"]').forEach(function (lnk) {
        lnk.addEventListener('click', function (e) {
            var t = document.querySelector(this.getAttribute('href'));
            if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
        });
    });

    /* ─── 3D tilt on review cards (desktop) ─── */
    if (!isMob()) {
        document.querySelectorAll('.review-card').forEach(function (c) {
            c.addEventListener('mousemove', function (e) {
                var r = c.getBoundingClientRect();
                var rx = (e.clientY - r.top - r.height / 2) / (r.height / 2) * -2;
                var ry = (e.clientX - r.left - r.width / 2) / (r.width / 2) * 2;
                c.style.transform = 'translateY(-6px) perspective(600px) rotateX(' + rx + 'deg) rotateY(' + ry + 'deg)';
            });
            c.addEventListener('mouseleave', function () { c.style.transform = ''; });
        });
    }
});