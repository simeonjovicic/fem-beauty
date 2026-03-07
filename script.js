/* ============================================================
   FEM Beauty Wien — script.js
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {

    // Sticky nav
    var nav = document.getElementById('nav');
    window.addEventListener('scroll', function () {
        nav.classList.toggle('scrolled', window.scrollY > 60);
    });

    // Scroll reveal
    var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
            if (e.isIntersecting) e.target.classList.add('on');
        });
    }, { threshold: 0.08 });
    document.querySelectorAll('.rv').forEach(function (el) { obs.observe(el); });

});