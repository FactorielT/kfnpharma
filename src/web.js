'use strict';
const crypto = require('node:crypto');
const C = require('./core');
const N = require('./notifs');
const cfg = require('./config');
const { e } = C;

/* ---------- Menus (rôles vides = Administrateur / Super Admin) ---------- */
const MENU = [
  { key: 'accueil', label: 'Accueil', page: 'accueil' },
  { key: 'siege', label: 'Agence Siège', siege: true, roles: ['GST'], items: [
    ['familles', 'Familles articles'], ['articles', 'Articles'], ['stock_agences', 'Enregistrement du stock'],
    ['appro_depot', 'Approvisionnement du dépôt principal'], ['appro_agences', 'Approvisionnement des agences'],
    ['point_appros', 'Point des appros par agence'], ['stocks&prix=1', 'Prix de vente par agence'], ['fournisseurs', 'Fournisseurs'],
    ['compte_agences', 'Compte des agences (clientes du siège)', []], ['objectifs', 'Objectif par agence', []],
    ['histogramme', 'Histogramme des objectifs', []], ['messages_site', 'Messages du site web', []]] },
  { key: 'stocks', label: 'Gestion de stocks', roles: ['GST'], items: [
    ['precommande', "Pré-commande d'approvisionnement"], ['reception_appro', 'Approvisionnements (réception)'],
    ['point_appros', 'Point des appros (validés / non validés)'], ['stocks', 'Stocks articles'], ['stocks&prix=1', 'Prix de vente de mon agence'],
    ['inventaire', 'Inventaires stocks'], ['peremption', 'Retrait de stock (péremption)']] },
  { key: 'ventes', label: 'Ventes articles', roles: ['VEN'], items: [
    ['facture', 'Édition de factures / pro-forma'], ['modif_facture', 'Modification de factures'], ['clients', 'Clients']] },
  { key: 'caisse', label: 'Paiement caisse', roles: ['CAI'], items: [
    ['caisse_jour', "Paiement des factures éditées aujourd'hui"], ['caisse_impayes', 'Paiement des impayés (factures crédit)'],
    ['depenses', 'Dépenses journalières'], ['fermeture_caisse', 'Fermeture de caisse du jour'], ['arrets_caisse', "États d'arrêt de caisse"]] },
  { key: 'etats', label: 'Éditions des états', roles: ['CON'], items: [
    ['etats&r=ventes_jour', 'Bilans des ventes du jour'], ['etats&r=credits', 'Bilans crédits'], ['etats&r=credits_periode', 'Bilans sur période crédits'],
    ['etats&r=restes_client', 'Bilans des restes à payer par client'], ['etats&r=produits', 'Bilans produits sur période'],
    ['etats&r=clients_periode', 'Bilans clients sur période'], ['etats&r=ca_client', "Chiffres d'affaires par client"],
    ['etats&r=appros', 'Bilans approvisionnements', ['CON', 'GST']], ['etats&r=credits45', 'Bilans des crédits plus de 45 jours'],
    ['etats&r=paiements', 'Bilans des paiements par jour / période'], ['etats&r=compte_client', 'Compte client'],
    ['etats&r=inventaires', 'Historiques des inventaires', ['CON', 'GST']], ['arrets_caisse', "États d'arrêt de caisse"]] },
  { key: 'stats', label: 'Statistiques', siege: true, roles: ['CON'], items: [['statistiques', 'Statistique de vente par agence']] },
  { key: 'admin', label: 'ADMIN', roles: [], items: [
    ['utilisateurs', 'Utilisateurs'], ['agences', 'Paramétrage des agences'], ['whatsapp', 'Notifications WhatsApp'], ['fichiers', 'Modification des fichiers (tables)'],
    ['excel&a=import', 'Importation des données (Excel)'], ['excel&a=export', 'Exportation des données (Excel)'], ['csv', 'Importation de fichiers CSV']] },
];
function menuVisible(u, m) {
  if (m.siege && !C.isSiegeUser(u)) return [];
  return (m.items || []).filter(i => C.can(u, i[2] || m.roles));
}
function pageAllowed(u, page, sub = '') {
  if (page === 'accueil') return true;
  if (page === 'notifications') return N.concerne(u);
  return MENU.some(m => menuVisible(u, m).some(([k]) => {
    if (page === 'etats' && sub) return k === 'etats&r=' + sub;
    return k.split('&')[0] === page;
  }));
}

class Redirect extends Error { constructor(url) { super('redirect'); this.url = url; } }
const MSG_REUSSI = { save: 'Enregistrement réussi.', modify: 'Modification réussie.', delete: 'Suppression réussie.' };

/* ---------- Contexte d'une requête ---------- */
async function buildCtx(req, res) {
  const s = req.session;
  if (!s.csrf) s.csrf = crypto.randomBytes(16).toString('hex');
  const u = s.user || null;
  const ctx = {
    req, res, user: u, title: '', B: req.body || {}, files: req.files || [],
    get: (k, d = '') => { const v = req.query[k]; return v === undefined ? d : String(v).trim(); },
    post: (k, d = '') => { const v = (req.body || {})[k]; return v === undefined ? d : (typeof v === 'string' ? v.trim() : v); },
    arr: k => { const v = (req.body || {})[k] ?? (req.body || {})[k + '[]']; return v === undefined ? [] : (Array.isArray(v) ? v : [v]); },
    flash(msg, type = 'ok') { (s.flash ||= []).push([type, msg]); },
    redirect(url) {
      if (req.method === 'POST' && req.body?.mot_de_passe === undefined) {
        s.flash ||= [];
        const kind = req.body?._kind || (req.body?.del ? 'delete' : (req.body?.toggle || (req.body?.id && req.body.id !== '0') ? 'modify' : 'save'));
        if (!s.flash.some(f => f[0] === 'err')) s.flash.unshift(['dialog', MSG_REUSSI[kind] || MSG_REUSSI.save]);
      }
      throw new Redirect(url);
    },
    csrfField: () => `<input type="hidden" name="_csrf" value="${s.csrf}">`,
    can: roles => C.can(u, roles),
    isSiege: () => C.isSiegeUser(u),
    isSuper: () => C.isSuper(u), isAdmin: () => C.isAdmin(u),
    /* Modifier / supprimer : Super Admin, Administrateur et Responsable d'agence uniquement */
    canEdit: () => C.isAdmin(u) || C.level(u) === 'RAG',
    requireEdit(back) { if (!ctx.canEdit()) { ctx.flash('Seuls le Super Admin, l’Administrateur et le Responsable d’agence peuvent modifier ou supprimer.', 'err'); ctx.redirect(back); } },
    level: () => C.level(u), uname: () => u?.nom_prenoms || '', ustruct: () => u?.structures || '',
  };
  ctx.agences = C.isSiegeUser(u) ? (await C.rows('SELECT nom_structure FROM t_structure ORDER BY estsiege DESC, nom_structure')).map(r => r.nom_structure) : [u?.structures];
  ctx.agenceOk = a => (a && ctx.agences.includes(a)) ? a : ctx.ustruct();
  ctx.agOptions = (sel = null, blank = false, sansSiege = false) =>
    (blank ? '<option value="">— Choisir —</option>' : '') + ctx.agences.filter(a => !(sansSiege && a === C.SIEGE))
      .map(a => `<option value="${e(a)}"${a === sel ? ' selected' : ''}>${e(a)}</option>`).join('');
  ctx.pageAllowed = (p, sub) => pageAllowed(u, p, sub);
  return ctx;
}

/* ---------- Mise en page de l'application ---------- */
async function layout(ctx, page, cur, content) {
  const nt = N.concerne(ctx.user) ? await N.liste(ctx.user).catch(() => null) : null;
  const s = ctx.req.session, u = ctx.user;
  const fl = s.flash || []; s.flash = [];
  const dialogs = fl.filter(f => f[0] === 'dialog').map(f => f[1]);
  const nav = MENU.map(m => {
    if (m.page) return `<div class="nav-item${page === m.page ? ' active' : ''}"><a href="/gestion?p=${m.page}">${e(m.label)}</a></div>`;
    const it = menuVisible(u, m); if (!it.length) return '';
    const act = it.some(([k]) => k === cur);
    return `<div class="nav-item${act ? ' active' : ''}${m.key === 'admin' ? ' nav-admin' : ''}"><button type="button" aria-expanded="false">${e(m.label)}</button><div class="nav-sub">${
      it.map(([k, l]) => `<a href="/gestion?p=${e(k)}"${k === cur ? ' class="cur"' : ''}>${e(l)}</a>`).join('')}</div></div>`;
  }).join('');
  return `<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="csrf" content="${s.csrf}">
<title>${e(ctx.title || 'Gestion')} — KFN Pharma</title>
<meta name="theme-color" content="#E07F16">
<link rel="icon" href="/assets/img/logo.png"><link rel="manifest" href="/gestion/manifest.json">
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Sora:wght@600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/app.css">
<script src="/assets/js/app.js"></script>
</head><body>
<header class="app-head"><div class="app-head__in">
  <button class="burger" aria-label="Menu"><span></span><span></span><span></span></button>
  <a href="/gestion"><img src="/assets/img/logo.png" alt="KFN Pharma"></a>
  <div class="app-head__title">${e(cfg.appTitle)}</div>
  ${nt ? `<a class="notif-btn" href="/gestion?p=notifications" title="Notifications des pré-commandes" aria-label="Notifications">
    <span class="nb nb-rouge"${nt.rouge ? '' : ' hidden'}>${N.enveloppe('rouge', 20)}<b id="nbr">${nt.rouge}</b></span>
    <span class="nb nb-bleu"${nt.bleu ? '' : ' hidden'}>${N.enveloppe('bleu', 20)}<b id="nbb">${nt.bleu}</b></span>
    <span class="nb nb-vert"${nt.bleu || nt.rouge ? ' hidden' : ''} title="Tout est traité">${N.enveloppe('vert', 20)}</span></a>` : ''}
  <div class="app-head__who"><small>${e(C.dateLongue())}</small><b>${e(u.structures)}</b>Connecté(e) : <strong>${e(u.nom_prenoms)}</strong></div>
  <a class="logout" href="/gestion/logout" title="Se déconnecter" aria-label="Se déconnecter"><svg viewBox="0 0 24 24"><path d="M12 3v9M6.3 6.3a8 8 0 1 0 11.4 0"/></svg></a>
</div></header>
<nav class="app-nav" aria-label="Menu principal"><div class="app-nav__in">${nav}</div></nav>
<main class="main"${nt ? ` data-notif="${nt.bleu},${nt.rouge}"` : ''}>
${fl.filter(f => f[0] !== 'dialog').map(([t, m]) => `<div class="flash ${e(t)}">${e(m)}</div>`).join('')}
${dialogs.length ? `<script>document.addEventListener('DOMContentLoaded',function(){KFN.alert(${JSON.stringify(dialogs.join('\n'))});});</script>` : ''}
${content}
</main>
<footer class="app-foot">KFN Pharma — ${e(cfg.appTitle)} © ${new Date().getFullYear()}</footer>
</body></html>`;
}

module.exports = { MENU, menuVisible, pageAllowed, Redirect, buildCtx, layout, MSG_REUSSI };
