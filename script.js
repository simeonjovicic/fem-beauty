/* ============================================================
   FEM Beauty Wien — script.js
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {

    // Sticky nav
    var nav = document.getElementById('nav');
    window.addEventListener('scroll', function () {
        nav.classList.toggle('scrolled', window.scrollY > 60);
    });

    // Mobile menu
    var burger = document.getElementById('burger');
    var mobileMenu = document.getElementById('mobileMenu');

    if (burger && mobileMenu) {
        burger.addEventListener('click', function () {
            burger.classList.toggle('open');
            mobileMenu.classList.toggle('open');
            document.body.style.overflow = mobileMenu.classList.contains('open') ? 'hidden' : '';
        });

        // Close menu on link click
        mobileMenu.querySelectorAll('a').forEach(function (link) {
            link.addEventListener('click', function () {
                burger.classList.remove('open');
                mobileMenu.classList.remove('open');
                document.body.style.overflow = '';
            });
        });
    }

    // Scroll reveal
    var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
            if (e.isIntersecting) {
                e.target.classList.add('on');
            }
        });
    }, { threshold: 0.06, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.rv').forEach(function (el) {
        obs.observe(el);
    });

});