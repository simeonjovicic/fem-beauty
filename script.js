/* ============================================================
   FEM Beauty Wien — script.js
   ============================================================ */

// Sticky nav
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 60);
});

// Scroll reveal
const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('on'); });
}, { threshold: 0.08 });
document.querySelectorAll('.rv').forEach(el => obs.observe(el));