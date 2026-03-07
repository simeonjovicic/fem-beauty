/* ============================================================
   FEM Head Spa — JavaScript
   script.js
   ============================================================ */

/* ── CUSTOM CURSOR ──────────────────────────────────────── */
const cur = document.getElementById('cursor');
const rng = document.getElementById('ring');
let mx = 0, my = 0, rx = 0, ry = 0;

document.addEventListener('mousemove', e => {
    mx = e.clientX;
    my = e.clientY;
});

(function tick() {
    cur.style.left = mx + 'px';
    cur.style.top = my + 'px';
    rx += (mx - rx) * 0.11;
    ry += (my - ry) * 0.11;
    rng.style.left = rx + 'px';
    rng.style.top = ry + 'px';
    requestAnimationFrame(tick);
})();

// Cursor grow on interactive elements
document.querySelectorAll('a, button, .svc, .tcard, .gitem').forEach(el => {
    el.addEventListener('mouseenter', () => {
        rng.style.width = '56px';
        rng.style.height = '56px';
        rng.style.opacity = '.25';
    });
    el.addEventListener('mouseleave', () => {
        rng.style.width = '32px';
        rng.style.height = '32px';
        rng.style.opacity = '.5';
    });
});

/* ── STICKY NAV ─────────────────────────────────────────── */
const nav = document.getElementById('nav');

window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 60);
});

/* ── SCROLL REVEAL ──────────────────────────────────────── */
const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));