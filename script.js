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
        var closeMenu = function () {
            burger.classList.remove('open');
            mobMenu.classList.remove('open');
            document.body.style.overflow = '';
        };

        burger.addEventListener('click', function (e) {
            e.stopPropagation();
            burger.classList.toggle('open');
            mobMenu.classList.toggle('open');
            document.body.style.overflow = mobMenu.classList.contains('open') ? 'hidden' : '';
        });

        // Close when clicking anywhere on the mobile menu (background or links)
        mobMenu.addEventListener('click', closeMenu);

        // Prevents closing when clicking links (they bubble up and close via the mobMenu listener anyway, but we keep the logic clean)
        mobMenu.querySelectorAll('a').forEach(function (a) {
            a.addEventListener('click', closeMenu);
        });
    }

    /* ─── Lightbox ─────────────────────────── */
    var lightbox = document.getElementById('lightbox');
    var lbImg = document.getElementById('lightbox-img');
    var lbClose = document.querySelector('.lightbox-close');

    if (lightbox && lbImg) {
        var openLightbox = function (src) {
            lbImg.src = src;
            lightbox.classList.add('active');
            document.body.style.overflow = 'hidden';
        };

        var closeLightbox = function () {
            lightbox.classList.remove('active');
            document.body.style.overflow = '';
        };

        // Click on gallery images
        document.querySelectorAll('.gallery-item img, .story-img img').forEach(function (img) {
            img.addEventListener('click', function () {
                openLightbox(this.src);
            });
        });

        lbClose.addEventListener('click', closeLightbox);
        lightbox.addEventListener('click', function (e) {
            if (e.target === lightbox) closeLightbox();
        });

        // ESC key to close
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && lightbox.classList.contains('active')) closeLightbox();
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

    /* ═══ About Toggle ══════════════════════ */
    var aboutContent = document.querySelector('.about-text-content');
    var aboutBtn = document.querySelector('.about-more');
    if (aboutContent && aboutBtn) {
        aboutBtn.addEventListener('click', function () {
            var expanded = aboutContent.classList.toggle('expanded');
            aboutBtn.textContent = expanded ? 'Weniger lesen' : 'Mehr lesen...';
        });
    }


    /* ═══════════════════════════════════════════
       FLEX SLIDER — touch + mouse drag + LOOP
       ═══════════════════════════════════════════ */
    function FlexSlider(cfg) {
        this.container = cfg.container;
        this.cards = cfg.cards;
        this.dotsEl = cfg.dots || null;
        this.counterEl = cfg.counter || null;
        this.auto = cfg.auto || 0;
        this.loop = cfg.loop !== undefined ? cfg.loop : true; // DEFAULT: loop enabled
        this.current = 0;
        this.total = this.cards.length;
        this.track = null;
        this.timer = null;
        this.touchX0 = 0;
        this.touchY0 = 0;
        this.dx = 0;
        this.dragging = false;
        this.didDrag = false;
        if (this.total > 0) this._build();
    }

    FlexSlider.prototype._build = function () {
        this.track = document.createElement('div');
        this.track.className = 'slider-track';
        this.track.style.display = 'flex';
        this.track.style.width = '100%';
        this.track.style.transition = 'transform .5s cubic-bezier(.25,.46,.45,.94)';
        this.track.style.willChange = 'transform';

        var frag = document.createDocumentFragment();
        for (var i = 0; i < this.total; i++) {
            this.cards[i].style.flex = '0 0 100%';
            this.cards[i].style.minWidth = '0';
            this.cards[i].style.width = '100%';
            frag.appendChild(this.cards[i]);
        }
        this.track.appendChild(frag);
        this.container.appendChild(this.track);

        this._dots();
        this._counter();
        this._input();
        var self = this;
        this.container.addEventListener('click', function (e) {
            if (self.didDrag) { e.stopPropagation(); e.preventDefault(); self.didDrag = false; }
        }, true);
        if (this.auto > 0) this._startAuto();
    };

    FlexSlider.prototype.goTo = function (idx) {
        // Handle looping
        if (this.loop) {
            if (idx >= this.total) idx = 0;
            if (idx < 0) idx = this.total - 1;
        } else {
            if (idx < 0 || idx >= this.total) return;
        }
        this.current = idx;
        this.track.style.transform = 'translateX(-' + (idx * 100) + '%)';
        this._dots();
        this._counter();
    };
    FlexSlider.prototype.next = function () { this.goTo(this.current + 1); };
    FlexSlider.prototype.prev = function () { this.goTo(this.current - 1); };

    FlexSlider.prototype._dots = function () {
        if (!this.dotsEl) return;
        if (this.dotsEl.children.length !== this.total) {
            this.dotsEl.innerHTML = '';
            var self = this;
            for (var i = 0; i < this.total; i++) {
                var d = document.createElement('button');
                d.className = 'mob-dot';
                (function (idx) { d.addEventListener('click', function () { self.goTo(idx); if (self.auto > 0) self._startAuto(); }); })(i);
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

    FlexSlider.prototype._input = function () {
        var self = this;
        function onStart(x, y) { self.touchX0 = x; self.touchY0 = y; self.dx = 0; self.dragging = true; self.track.style.transition = 'none'; }
        function onMove(x, y) {
            if (!self.dragging) return;
            self.dx = x - self.touchX0;
            if (Math.abs(y - self.touchY0) > Math.abs(self.dx) * 1.2) { self.dragging = false; self._snapBack(); return; }
            var pct = -(self.current * 100) + (self.dx / self.container.offsetWidth) * 100;
            self.track.style.transform = 'translateX(' + pct + '%)';
        }
        function onEnd() {
            if (!self.dragging) return;
            self.dragging = false;
            self.track.style.transition = '';
            var th = self.container.offsetWidth * 0.2;
            if (self.dx < -th) {
                self.didDrag = true;
                self.goTo(self.current + 1);
            } else if (self.dx > th) {
                self.didDrag = true;
                self.goTo(self.current - 1);
            } else {
                if (Math.abs(self.dx) > 10) self.didDrag = true;
                self._snapBack();
            }
            if (self.auto > 0) self._startAuto();
        }
        this.container.addEventListener('touchstart', function (e) { onStart(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
        this.container.addEventListener('touchmove', function (e) { onMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
        this.container.addEventListener('touchend', onEnd, { passive: true });
        this.container.style.cursor = 'grab';
        this.container.addEventListener('mousedown', function (e) { e.preventDefault(); self.container.style.cursor = 'grabbing'; onStart(e.clientX, e.clientY); });
        document.addEventListener('mousemove', function (e) { if (self.dragging) { e.preventDefault(); onMove(e.clientX, e.clientY); } });
        document.addEventListener('mouseup', function () { if (self.dragging) { self.container.style.cursor = 'grab'; onEnd(); } });
        this.container.addEventListener('dragstart', function (e) { e.preventDefault(); });
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
        if (this.track && this.track.parentNode) {
            while (this.track.firstChild) {
                var c = this.track.firstChild;
                c.style.flex = ''; c.style.minWidth = ''; c.style.width = '';
                this.container.appendChild(c);
            }
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
            counter: document.querySelector('.srv-counter'),
            loop: true  // Loop enabled for services
        });
    }
    function destroySrvMobile() { if (srvSlider) { srvSlider.destroy(); srvSlider = null; } }


    /* ═══ Unified Reviews — with platform filter ═══ */
    var carousel = document.getElementById('reviewsCarousel');
    var dotsContainer = document.getElementById('reviewsDots');
    var mobTrack = document.getElementById('mobReviewsTrack');
    var mobReviewCounter = document.querySelector('.review-mob-counter');
    var twPill = document.querySelector('.tw-pill');
    var goPill = document.querySelector('.go-pill');
    var totalLabel = document.querySelector('.reviews-src-total');

    /* Store ALL review card HTML with platform info */
    var allCards = [];
    carousel.querySelectorAll('.reviews-set').forEach(function (s) {
        s.querySelectorAll('.review-card').forEach(function (c) {
            allCards.push({ html: c.outerHTML, platform: c.getAttribute('data-platform') || 'treatwell' });
        });
    });

    var activeFilter = null; // null = all, 'treatwell', 'google'
    var sets, currentSet = 0, deskTimer, desktopDots;
    var revSlider = null;

    /* ── Clamp long review texts with "Mehr anzeigen" toggle ── */
    function clampReviews(container) {
        container.querySelectorAll('.review-text').forEach(function (el) {
            if (el.parentElement.classList.contains('review-text-wrap')) return;

            var wrap = document.createElement('div');
            wrap.className = 'review-text-wrap';
            el.parentElement.insertBefore(wrap, el);
            wrap.appendChild(el);

            el.classList.add('clamped');

            requestAnimationFrame(function () {
                if (el.scrollHeight > el.clientHeight + 2) {
                    var btn = document.createElement('span');
                    btn.className = 'review-more';
                    btn.textContent = 'Mehr anzeigen';
                    btn.addEventListener('click', function (e) {
                        e.stopPropagation();
                        var expanded = el.classList.toggle('expanded');
                        btn.textContent = expanded ? 'Weniger anzeigen' : 'Mehr anzeigen';
                    });
                    wrap.appendChild(btn);
                } else {
                    el.classList.remove('clamped');
                }
            });
        });
    }

    /* ── Build desktop carousel sets from filtered cards ── */
    function buildDesktopSets(cards) {
        clearInterval(deskTimer);
        carousel.innerHTML = '';
        dotsContainer.innerHTML = '';
        currentSet = 0;

        for (var i = 0; i < cards.length; i += 2) {
            var setDiv = document.createElement('div');
            setDiv.className = 'reviews-set' + (i === 0 ? ' active' : '');
            setDiv.innerHTML = cards[i].html + (cards[i + 1] ? cards[i + 1].html : '');
            carousel.appendChild(setDiv);
        }

        sets = carousel.querySelectorAll('.reviews-set');

        sets.forEach(function (_, idx) {
            var dot = document.createElement('button');
            dot.className = 'reviews-dot' + (idx === 0 ? ' active' : '');
            dot.addEventListener('click', function () { showSet(idx); startDeskAuto(); });
            dotsContainer.appendChild(dot);
        });
        desktopDots = dotsContainer.querySelectorAll('.reviews-dot');

        clampReviews(carousel);
        if (!isMob()) startDeskAuto();
    }

    function showSet(idx) {
        if (idx === currentSet || idx < 0 || idx >= sets.length) return;
        sets[currentSet].classList.remove('active');
        sets[currentSet].classList.add('exiting');
        var prev = currentSet;
        sets[idx].classList.add('active');
        currentSet = idx;
        setTimeout(function () { sets[prev].classList.remove('exiting'); }, 700);
        desktopDots.forEach(function (d, i) { d.classList.toggle('active', i === idx); });
    }

    function startDeskAuto() {
        clearInterval(deskTimer);
        if (!isMob() && sets.length > 1) deskTimer = setInterval(function () { showSet((currentSet + 1) % sets.length); }, 5000);
    }

    /* ── Build mobile slider from filtered cards ── */
    function buildMobileSlider(cards) {
        destroyRevMobile();
        if (!isMob() || !mobTrack) return;
        mobTrack.innerHTML = cards.map(function (c) { return c.html; }).join('');
        var cardEls = Array.from(mobTrack.querySelectorAll('.review-card'));
        revSlider = new FlexSlider({
            container: mobTrack,
            cards: cardEls,
            counter: mobReviewCounter,
            auto: 4500,
            loop: true  // Loop enabled for reviews
        });
        clampReviews(mobTrack);
    }
    function destroyRevMobile() {
        if (revSlider) { revSlider.destroy(); revSlider = null; }
        if (mobTrack) mobTrack.innerHTML = '';
        if (mobReviewCounter) mobReviewCounter.textContent = '';
    }

    /* ── Apply filter ── */
    function applyFilter(platform) {
        if (activeFilter === platform) {
            activeFilter = null;
        } else {
            activeFilter = platform;
        }

        twPill.classList.toggle('active', activeFilter === 'treatwell');
        goPill.classList.toggle('active', activeFilter === 'google');

        if (activeFilter === 'treatwell') totalLabel.textContent = 'Nur Treatwell Bewertungen';
        else if (activeFilter === 'google') totalLabel.textContent = 'Nur Google Bewertungen';
        else totalLabel.textContent = '1.420+ verifizierte Bewertungen';

        var filtered = activeFilter
            ? allCards.filter(function (c) { return c.platform === activeFilter; })
            : allCards;

        buildDesktopSets(filtered);
        if (isMob()) buildMobileSlider(filtered);
    }

    twPill.addEventListener('click', function () { applyFilter('treatwell'); });
    goPill.addEventListener('click', function () { applyFilter('google'); });

    buildDesktopSets(allCards);
    if (isMob()) buildMobileSlider(allCards);

    /* ── Desktop drag-to-swipe on reviews ── */
    (function () {
        var el = carousel;
        var x0 = 0, dragging = false;
        el.addEventListener('mousedown', function (e) { e.preventDefault(); x0 = e.clientX; dragging = true; el.style.cursor = 'grabbing'; });
        document.addEventListener('mousemove', function (e) { if (dragging) e.preventDefault(); });
        document.addEventListener('mouseup', function (e) {
            if (!dragging) return; dragging = false; el.style.cursor = 'grab';
            var dx = e.clientX - x0;
            if (Math.abs(dx) > 60) { dx < 0 ? showSet(Math.min(currentSet + 1, sets.length - 1)) : showSet(Math.max(currentSet - 1, 0)); startDeskAuto(); }
        });
        el.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; dragging = true; }, { passive: true });
        el.addEventListener('touchend', function (e) {
            if (!dragging) return; dragging = false;
            var dx = e.changedTouches[0].clientX - x0;
            if (Math.abs(dx) > 60) { dx < 0 ? showSet(Math.min(currentSet + 1, sets.length - 1)) : showSet(Math.max(currentSet - 1, 0)); startDeskAuto(); }
        }, { passive: true });
        el.addEventListener('dragstart', function (e) { e.preventDefault(); });
    })();


    /* ─── Init + resize ─────────────────────── */
    if (isMob()) { initSrvMobile(); buildMobileSlider(activeFilter ? allCards.filter(function (c) { return c.platform === activeFilter }) : allCards); }

    var rto;
    window.addEventListener('resize', function () {
        clearTimeout(rto);
        rto = setTimeout(function () {
            var filtered = activeFilter ? allCards.filter(function (c) { return c.platform === activeFilter }) : allCards;
            if (isMob()) {
                initSrvMobile();
                buildMobileSlider(filtered);
                clearInterval(deskTimer);
            } else {
                destroySrvMobile();
                destroyRevMobile();
                buildDesktopSets(filtered);
            }
        }, 250);
    });


    /* ═══ Counter animation ═════════════════ */
    var cDone = false;
    var sObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting && !cDone) { cDone = true; runCounters(); sObs.disconnect(); } });
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

        gsap.to('.hero-bg img', { y: 150, scale: 1.1, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
        gsap.to('.hero-content', { y: -80, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: '50% top', end: 'bottom top', scrub: true } });
        gsap.to('.hero-scroll', { opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: '15% top', end: '35% top', scrub: true } });

        gsap.utils.toArray('.usp-strip-item').forEach(function (el, i) {
            gsap.fromTo(el, { x: -40, opacity: 0 }, { x: 0, opacity: 1, duration: 1, delay: i * .15, ease: 'expo.out', scrollTrigger: { trigger: '.usp-strip', start: 'top 85%', toggleActions: 'play none none none' } });
        });

        gsap.to('.story-img img', { y: -80, ease: 'none', scrollTrigger: { trigger: '.story', start: 'top bottom', end: 'bottom top', scrub: 1.5 } });

        gsap.utils.toArray('.gallery-item').forEach(function (el, i) {
            gsap.fromTo(el, { y: 40, opacity: 0, scale: .95 }, { y: 0, opacity: 1, scale: 1, duration: 1, delay: i * .12, ease: 'expo.out', scrollTrigger: { trigger: '.gallery', start: 'top 85%', toggleActions: 'play none none none' } });
        });
        gsap.utils.toArray('.gallery-item img').forEach(function (img) {
            gsap.to(img, { y: -30, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: 1.5 } });
        });

        if (!isMob()) {
            gsap.utils.toArray('.srv-card').forEach(function (c, i) {
                gsap.fromTo(c, { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 1, delay: i * .1, ease: 'expo.out', scrollTrigger: { trigger: '.srv-grid', start: 'top 80%', toggleActions: 'play none none none' } });
            });
        }

        gsap.utils.toArray('.stat-item').forEach(function (el, i) {
            gsap.fromTo(el, { scale: .8, opacity: 0 }, { scale: 1, opacity: 1, duration: .8, delay: i * .12, ease: 'expo.out', scrollTrigger: { trigger: '.stats-strip', start: 'top 80%', toggleActions: 'play none none none' } });
        });

        gsap.fromTo('.reviews-carousel', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.reviews', start: 'top 75%', toggleActions: 'play none none none' } });

        gsap.utils.toArray('.tm-card').forEach(function (c, i) {
            gsap.fromTo(c, { y: 50, opacity: 0, rotation: i % 2 === 0 ? -2 : 2 }, { y: 0, opacity: 1, rotation: 0, duration: .9, delay: i * .07, ease: 'expo.out', scrollTrigger: { trigger: '.team-grid', start: 'top 80%', toggleActions: 'play none none none' } });
        });

        gsap.fromTo('.contact-info', { x: -80, opacity: 0 }, { x: 0, opacity: 1, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.contact', start: 'top 70%', toggleActions: 'play none none none' } });
        gsap.fromTo('.contact-map', { x: 80, opacity: 0 }, { x: 0, opacity: 1, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.contact', start: 'top 70%', toggleActions: 'play none none none' } });
        gsap.fromTo('footer', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: 'footer', start: 'top 90%', toggleActions: 'play none none none' } });

        document.querySelectorAll('.services-head, .reviews-head, .team-top').forEach(function (el) {
            gsap.fromTo(el, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none none' } });
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