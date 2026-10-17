/* KFN PHARMA - Site internet */
(function () {
  'use strict';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- Slider 3D ---------- */
  var stage = $('[data-slider]');
  if (stage) {
    var slides = $$('.slide', stage), dots = $('.dots'), cur = 0, timer = null;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    slides.forEach(function (_, i) {
      var b = document.createElement('button');
      b.setAttribute('role', 'tab'); b.setAttribute('aria-label', 'Image ' + (i + 1));
      b.addEventListener('click', function () { go(i); restart(); });
      dots.appendChild(b);
    });
    function go(i) {
      var n = slides.length; if (!n) return;
      cur = (i + n) % n;
      slides.forEach(function (s, k) {
        s.classList.remove('is-active', 'is-prev', 'is-next');
        if (k === cur) s.classList.add('is-active');
        else if (k === (cur - 1 + n) % n) s.classList.add('is-prev');
        else if (k === (cur + 1) % n) s.classList.add('is-next');
        s.setAttribute('aria-hidden', k === cur ? 'false' : 'true');
      });
      $$('button', dots).forEach(function (d, k) { d.setAttribute('aria-selected', k === cur); });
    }
    function restart() { clearInterval(timer); if (!reduce) timer = setInterval(function () { go(cur + 1); }, 6000); }
    slides.forEach(function (s, k) {
      s.addEventListener('click', function (e) {
        if (s.classList.contains('is-active')) return;
        e.preventDefault(); go(k); restart();
      });
    });
    $('.nav-arrow.prev').addEventListener('click', function () { go(cur - 1); restart(); });
    $('.nav-arrow.next').addEventListener('click', function () { go(cur + 1); restart(); });
    // glisser au doigt
    var x0 = null;
    stage.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) { go(cur + (dx < 0 ? 1 : -1)); restart(); }
      x0 = null;
    });
    stage.addEventListener('mouseenter', function () { clearInterval(timer); });
    stage.addEventListener('mouseleave', restart);
    go(0); restart();
  }

  /* ---------- Menu ---------- */
  var burger = $('.burger'), menu = $('#menu');
  burger.addEventListener('click', function () {
    var open = menu.classList.toggle('open');
    burger.setAttribute('aria-expanded', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });
  $$('.sub-toggle').forEach(function (t) {
    t.addEventListener('click', function () {
      var p = t.parentNode, open = !p.classList.contains('open');
      $$('.has-sub').forEach(function (h) { h.classList.remove('open'); });
      p.classList.toggle('open', open); t.setAttribute('aria-expanded', open);
    });
  });
  $$('#menu a').forEach(function (a) {
    a.addEventListener('click', function () {
      menu.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); document.body.style.overflow = '';
      $$('.has-sub').forEach(function (h) { h.classList.remove('open'); });
    });
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.has-sub')) $$('.has-sub').forEach(function (h) { h.classList.remove('open'); });
  });

  /* Lien actif au défilement */
  var links = $$('#menu > a[href^="#"]');
  var secs = links.map(function (a) { return a.getAttribute('href') === '#top' ? document.body : $(a.getAttribute('href')); });
  var totop = $('.totop');
  window.addEventListener('scroll', function () {
    var y = window.scrollY + 140, idx = 0;
    secs.forEach(function (s, i) { if (s && s !== document.body && s.offsetTop <= y) idx = i; });
    links.forEach(function (a, i) { a.classList.toggle('is-active', i === idx); });
    totop.classList.toggle('show', window.scrollY > 600);
  }, { passive: true });

  /* Barres de compétences */
  var sk = $('.skills');
  if (sk && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (en, o) {
      if (en[0].isIntersecting) { sk.classList.add('in'); o.disconnect(); }
    }, { threshold: .4 }).observe(sk);
  } else if (sk) sk.classList.add('in');

  /* ---------- Recherche produits ---------- */
  var sbox = $('.search'), sinput = $('.search input'), sres = $('.search__res'), st;
  function openSearch() { sbox.hidden = false; setTimeout(function () { sinput.focus(); }, 30); }
  function closeSearch() { sbox.hidden = true; }
  $('.search-btn').addEventListener('click', openSearch);
  $('.search__close').addEventListener('click', closeSearch);
  sbox.addEventListener('click', function (e) { if (e.target === sbox) closeSearch(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSearch(); });
  sinput.addEventListener('input', function () {
    clearTimeout(st);
    var v = sinput.value.trim();
    if (v.length < 2) { sres.innerHTML = ''; return; }
    st = setTimeout(function () {
      fetch('/recherche?q=' + encodeURIComponent(v)).then(function (r) { return r.json(); }).then(function (d) {
        sres.innerHTML = '';
        if (!d.length) { sres.innerHTML = '<li>Aucun produit trouvé. Contactez-nous, nous pouvons le commander pour vous.</li>'; return; }
        d.forEach(function (p) {
          var li = document.createElement('li');
          li.innerHTML = '<span></span><small></small>';
          li.firstChild.textContent = p.nom; li.lastChild.textContent = p.famille || '';
          sres.appendChild(li);
        });
      }).catch(function () { sres.innerHTML = '<li>Recherche indisponible pour le moment.</li>'; });
    }, 250);
  });

  /* ---------- Formulaire de contact ---------- */
  var form = $('#contactForm');
  if (form) form.addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = $('.form-msg', form), btn = $('button', form);
    if (!form.checkValidity()) { msg.className = 'form-msg err'; msg.textContent = 'Renseignez votre nom, un e-mail valide et votre message.'; return; }
    btn.disabled = true; msg.className = 'form-msg'; msg.textContent = 'Envoi en cours…';
    fetch(form.action, { method: 'POST', body: new FormData(form), headers: { 'X-Requested-With': 'fetch' } })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        msg.className = 'form-msg ' + (d.ok ? 'ok' : 'err'); msg.textContent = d.message;
        if (d.ok) form.reset();
      })
      .catch(function () { msg.className = 'form-msg err'; msg.textContent = "Le message n'a pas pu être envoyé. Appelez-nous directement."; })
      .finally(function () { btn.disabled = false; });
  });
})();
