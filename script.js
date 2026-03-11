document.addEventListener('DOMContentLoaded', function () {
    // Sticky nav
    var nav = document.getElementById('nav');
    window.addEventListener('scroll', function () {
        nav.classList.toggle('scrolled', window.scrollY > 60);
    });

    // Mobile menu
    var burger = document.getElementById('burger');
    var mob = document.getElementById('mobileMenu');
    if (burger && mob) {
        burger.addEventListener('click', function () {
            burger.classList.toggle('open');
            mob.classList.toggle('open');
            document.body.style.overflow = mob.classList.contains('open') ? 'hidden' : '';
        });
        mob.querySelectorAll('a').forEach(function (a) {
            a.addEventListener('click', function () {
                burger.classList.remove('open');
                mob.classList.remove('open');
                document.body.style.overflow = '';
            });
        });
    }

    // Scroll reveal
    var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
            if (e.isIntersecting) e.target.classList.add('on');
        });
    }, { threshold: 0.06, rootMargin: '0px 0px -30px 0px' });
    document.querySelectorAll('.rv').forEach(function (el) { obs.observe(el); });
});