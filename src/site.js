'use strict';
/* Site internet KFN PHARMA (page d'accueil, contact, recherche de produits) */
const C = require('./core');
const { e } = C;
const icons = {
  entretien: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  installation: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4M7 9h4M7 12h7"/>',
  vente: '<path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"/><circle cx="10" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/>',
};
const tel = t => 'tel:' + String(t || '').replace(/[^0-9+]/g, '');

async function home(req, res) {
  let dbOk = true, slides = [], services = [], activites = [], competences = [], promos = [], equipe = [], S = {};
  try {
    [slides, services, activites, competences, promos, equipe] = await Promise.all([
      C.rows('SELECT * FROM site_slides WHERE actif = 1 ORDER BY ordre LIMIT 3'),
      C.rows('SELECT * FROM site_services WHERE actif = 1 ORDER BY ordre'),
      C.rows('SELECT * FROM site_activites WHERE actif = 1 ORDER BY ordre'),
      C.rows('SELECT * FROM site_competences ORDER BY ordre'),
      C.rows('SELECT * FROM site_promotions WHERE actif = 1 ORDER BY ordre'),
      C.rows('SELECT * FROM site_equipe WHERE actif = 1 ORDER BY ordre')]);
    S = await C.settings();
  } catch (err) { dbOk = false; }
  for (const x of [...slides, ...promos, ...equipe]) for (const k of ['image', 'photo']) if (x[k] && !/^(https?:|\/)/.test(x[k])) x[k] = '/' + x[k];
  const tel1 = S.telephone1 || '(+225) 01 43 43 43 19', tel2 = S.telephone2 || '(+225) 05 05 44 44 44', tel3 = S.telephone3 || '(+225) 07 08 56 36 57';
  const mail = S.email || 'infos@kfnpharma.com';
  const adr = S.adresse || "Abidjan – Yopougon Nouvelle Gare UTB, rez-de-chaussée de l'immeuble collé à la Gare";
  res.type('html').send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>KFN Pharma — Le fournisseur N°1 du matériel médical en Côte d'Ivoire</title>
<meta name="description" content="KFN Pharma : vente, installation et entretien de matériel biomédical à Abidjan et dans nos agences de Côte d'Ivoire.">
<meta name="theme-color" content="#EE8320">
<link rel="icon" href="/assets/img/logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Sora:wght@500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${C.asset('/assets/css/site.css')}">
</head>
<body>

<!-- Barre supérieure -->
<div class="topbar">
  <div class="wrap topbar__in">
    <div class="topbar__info">
      <a href="mailto:${e(mail)}"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>${e(mail)}</a>
      <a href="${tel(tel1)}" class="hide-sm"><svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>${e(tel1)} / ${e(tel2)}</a>
    </div>
    <div class="topbar__right">
      <nav class="social" aria-label="Réseaux sociaux">
        <a href="${e((S.facebook || '#'))}" aria-label="Facebook"><svg viewBox="0 0 24 24"><path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z"/></svg></a>
        <a href="${e((S.instagram || '#'))}" aria-label="Instagram"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/></svg></a>
        <a href="${e((S.linkedin || '#'))}" aria-label="LinkedIn"><svg viewBox="0 0 24 24"><path d="M4 9h4v11H4zM6 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM10 9h4v1.7c.6-1 2-2 4-2 3 0 4 2 4 5V20h-4v-5.5c0-1.5-.5-2.5-2-2.5s-2 1-2 2.5V20h-4z"/></svg></a>
      </nav>
      <a class="btn-connexion" href="/gestion/login">
        <svg viewBox="0 0 24 24"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
        Espace Connexion
      </a>
    </div>
  </div>
</div>

<!-- En-tête -->
<header class="header" id="top">
  <div class="wrap header__in">
    <a href="#top" class="brand"><img src="/assets/img/logo.png" alt="KFN Pharma — Le fournisseur N°1 du matériel médical" width="160" height="76"></a>
    <button class="burger" aria-label="Ouvrir le menu" aria-expanded="false" aria-controls="menu"><span></span><span></span><span></span></button>
    <nav class="menu" id="menu" aria-label="Navigation principale">
      <a href="#top" class="is-active">Accueil</a>
      <a href="#apropos">À propos</a>
      <div class="has-sub">
        <button type="button" class="sub-toggle" aria-expanded="false">Services <i>+</i></button>
        <div class="sub">
          ${services.map((s) => { return `<a href="#services">${e(s.titre)}</a>`; }).join('')}
        </div>
      </div>
      <div class="has-sub">
        <button type="button" class="sub-toggle" aria-expanded="false">Nos activités <i>+</i></button>
        <div class="sub">
          ${activites.map((a) => { return `<a href="#activites">${e(a.titre)}</a>`; }).join('')}
        </div>
      </div>
      <a href="#contact">Contact</a>
      <a href="/gestion/login" class="menu__login">Espace Connexion</a>
    </nav>
    <button class="search-btn" aria-label="Rechercher un produit"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg></button>
  </div>
</header>

<main>
<!-- Slider 3D -->
<section class="hero" aria-label="Présentation">
  <div class="stage" data-slider>
    ${slides.map((s, i) => { const duo = s.image.includes('promo-'); return `
    <article class="slide${duo ? ' slide--duo' : ''}" data-i="${i}">
      ${(duo) ? `
        <div class="duo">
          ${promos.map((p) => { return `<img src="${e(p.image)}" alt="${e(p.titre)}">`; }).join('')}
        </div>
      ` : `
        <img class="slide__img" src="${e(s.image)}" alt="" ${i ? 'loading="lazy"' : ''}>
      `}
      <div class="slide__txt">
        <h2>${e(s.titre)}</h2>
        <p>${e(s.sous_titre)}</p>
        ${(s.bouton_texte) ? `<a class="btn" href="${e(s.bouton_lien)}">${e(s.bouton_texte)}</a>` : ''}
      </div>
    </article>
    `; }).join('')}
  </div>
  <button class="nav-arrow prev" aria-label="Image précédente"><svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg></button>
  <button class="nav-arrow next" aria-label="Image suivante"><svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></button>
  <div class="dots" role="tablist"></div>
</section>

<!-- À propos -->
<section class="about wrap" id="apropos">
  <div class="about__txt">
    <h2>Nous fournissons et installons tout type de matériel biomédical</h2>
    <p>${e((S.a_propos || ''))}</p>
    <div class="skills">
      ${competences.map((c) => { return `
      <div class="skill">
        <div class="skill__head"><span>${e(c.libelle)}</span><b>${Number(c.pourcentage)}%</b></div>
        <div class="skill__bar"><i style="--w: ${Number(c.pourcentage)}%"></i></div>
      </div>
      `; }).join('')}
    </div>
    <a href="#contact" class="btn">Commencer</a>
  </div>
  <div class="about__promos">
    ${promos.map((p) => { return `
      <a href="${e(p.lien || '#contact')}" class="promo"><img src="${e(p.image)}" alt="${e(p.titre)}" loading="lazy"></a>
    `; }).join('')}
  </div>
</section>

<!-- Services -->
<section class="services" id="services">
  <div class="wrap">
    <header class="sec-head"><span class="kicker">Services</span><h2>Nos services</h2></header>
    <div class="services__grid">
      ${services.map((s) => { return `
      <article class="service">
        <svg viewBox="0 0 24 24" class="service__ico">${(icons[s.icone] || icons.vente)}</svg>
        <h3>${e(s.titre)}</h3>
        <p>${e(s.resume)}</p>
      </article>
      `; }).join('')}
    </div>
  </div>
</section>

<!-- Activités -->
<section class="activites wrap" id="activites">
  <header class="sec-head"><span class="kicker">Nos activités</span><h2>Ce que nous livrons aux établissements de santé</h2></header>
  <div class="act__list">
    ${activites.map((a) => { return `
    <article class="act">
      <h3>${e(a.titre)}</h3>
      <p>${e(a.description)}</p>
    </article>
    `; }).join('')}
  </div>
</section>

<!-- Équipe -->
<section class="team" id="equipe">
  <div class="wrap">
    <header class="sec-head"><span class="kicker">Des experts</span><h2>Les membres de notre équipe</h2></header>
    <div class="team__grid">
      ${equipe.map((m) => { return `
      <figure class="member">
        <img src="${e(m.photo)}" alt="${e(m.nom)}" loading="lazy">
        <figcaption><b>${e(m.nom)}</b><span>${e(m.fonction)}</span></figcaption>
      </figure>
      `; }).join('')}
    </div>
  </div>
</section>

<!-- Contact -->
<section class="contact wrap" id="contact">
  <div class="contact__form">
    <span class="kicker">Contact</span>
    <h2>Entrer en contact</h2>
    <form id="contactForm" action="/contact" method="post" novalidate>
      <div class="row2">
        <label><span>Nom</span><input name="nom" required autocomplete="name"></label>
        <label><span>E-mail</span><input name="email" type="email" required autocomplete="email"></label>
      </div>
      <label class="half"><span>Numéro de téléphone</span><input name="telephone" type="tel" autocomplete="tel"></label>
      <label><span>Votre message</span><textarea name="message" rows="5" required></textarea></label>
      <input type="text" name="site_web" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
      <button class="btn" type="submit">Envoyer le message</button>
      <p class="form-msg" role="status"></p>
    </form>
  </div>
  <aside class="contact__info">
    <h3>Contact info</h3>
    <dl>
      <dt>Adresse</dt><dd>${e(adr)}</dd>
      <dt>Téléphone</dt><dd><a href="${tel(tel1)}">${e(tel1)}</a><br><a href="${tel(tel3)}">${e(tel3)}</a></dd>
      <dt>E-mail</dt><dd><a href="mailto:${e(mail)}">${e(mail)}</a></dd>
      <dt>Heures d'ouverture</dt><dd>${e((S.horaires_semaine || ''))}<br>${e((S.horaires_weekend || ''))}</dd>
    </dl>
    <a class="wa" href="https://wa.me/${String(tel3).replace(/[^0-9]/g, '')}" target="_blank" rel="noopener">Écrire sur WhatsApp</a>
  </aside>
</section>
</main>

<footer class="footer">
  <div class="wrap footer__in">
    <div>
      <img src="/assets/img/logo.png" alt="KFN Pharma" class="footer__logo" width="150" height="71">
      <p>Matériel et fournitures médicales de haute qualité.</p>
    </div>
    <div>
      <h4>Contact</h4>
      <p>${e(adr)}</p>
      <p><a href="${tel(tel1)}">${e(tel1)}</a> / <a href="${tel(tel2)}">${e(tel2)}</a></p>
      <p><a href="mailto:${e(mail)}">${e(mail)}</a></p>
    </div>
    <div>
      <h4>Liens</h4>
      <p><a href="#services">Nos services</a></p>
      <p><a href="#activites">Nos activités</a></p>
      <p><a href="/gestion/login">Espace Connexion</a></p>
    </div>
  </div>
  <div class="wrap footer__copy">Copyright © ${new Date().getFullYear()} KFN PHARMA — Tous droits réservés.</div>
</footer>

<a href="#top" class="totop" aria-label="Revenir en haut"><svg viewBox="0 0 24 24"><path d="m6 15 6-6 6 6"/></svg></a>

<!-- Recherche produits -->
<div class="search" hidden>
  <div class="search__box" role="dialog" aria-label="Rechercher un produit">
    <input type="search" placeholder="Rechercher un produit : seringue, tensiomètre, chaise roulante…" aria-label="Produit">
    <button class="search__close" aria-label="Fermer">×</button>
    <ul class="search__res"></ul>
  </div>
</div>

${!dbOk ? `<div class="db-warning">Base de données non connectée : vérifiez la configuration (.env).</div>` : ''}
<script src="${C.asset('/assets/js/site.js')}"></script>
</body>
</html>
`);
}

async function contact(req, res) {
  const ajax = !!req.get('x-requested-with');
  const reply = (ok, message) => ajax ? res.json({ ok, message }) : res.type('html').send(`<!doctype html><meta charset="utf-8"><p>${e(message)}</p><p><a href="/#contact">Retour au site</a></p>`);
  const b = req.body || {};
  if (b.site_web) return reply(true, 'Merci, votre message a bien été envoyé.');
  const nom = String(b.nom || '').trim().slice(0, 120), email = String(b.email || '').trim().slice(0, 150);
  const telephone = String(b.telephone || '').trim().slice(0, 40), message = String(b.message || '').trim().slice(0, 5000);
  if (!nom || !message || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return reply(false, 'Renseignez votre nom, un e-mail valide et votre message.');
  const ip = req.ip || '';
  try {
    if (Number(await C.val("SELECT COUNT(*) FROM site_messages_contact WHERE ip = ? AND date_envoi > NOW() - INTERVAL '1 hour'", [ip])) >= 5)
      return reply(false, 'Trop de messages envoyés. Réessayez dans une heure ou appelez-nous.');
    await C.q('INSERT INTO site_messages_contact (nom, email, telephone, message, ip) VALUES (?,?,?,?,?)', [nom, email, telephone, message, ip]);
  } catch (err) { return reply(false, "Le message n'a pas pu être enregistré. Appelez-nous directement."); }
  reply(true, `Merci ${nom}, votre message a bien été envoyé. Nous vous répondons rapidement.`);
}

async function recherche(req, res) {
  const qs = String(req.query.q || '').trim();
  if (qs.length < 2) return res.json([]);
  try {
    res.json(await C.rows('SELECT DISTINCT libarticles AS nom, libellefa AS famille FROM t_articles WHERE libarticles ILIKE ? OR libellefa ILIKE ? ORDER BY libarticles LIMIT 15', ['%' + qs + '%', '%' + qs + '%']));
  } catch { res.json([]); }
}
module.exports = { home, contact, recherche };
