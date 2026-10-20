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
    ['compte_agences', 'Compte des agences (clientes du siège)', []], ['objectifs', 'Objectif par agence', []],
    ['histogramme', 'Histogramme des objectifs', []]] },
  { key: 'stocks', label: 'Gestion de stocks', roles: ['GST'], items: [
    ['precommande', "Pré-commande d'approvisionnement"], ['reception_appro', 'Approvisionnements (réception)'],
    ['stocks', 'Stocks articles'], ['inventaire', 'Inventaires stocks'], ['peremption', 'Retrait de stock (péremption)']] },
  { key: 'ventes', label: 'Ventes articles', roles: ['VEN'], items: [
    ['facture', 'Édition de factures / pro-forma'], ['modif_facture', 'Modification de factures'], ['clients', 'Clients'],
    ['stocks&prix=1', 'Prix de vente par agence', ['RAG']]] },
  { key: 'caisse', label: 'Paiement caisse', roles: ['CAI'], items: [
    ['caisse_jour', "Paiement des factures éditées aujourd'hui"], ['caisse_impayes', 'Paiement des impayés (factures crédit)'],
    ['compte_agences', 'Compte des agences (clientes du siège)'], ['depenses', 'Dépenses journalières'], ['fermeture_caisse', 'Fermeture de caisse du jour'], ['arrets_caisse', "États d'arrêt de caisse"]] },
  { key: 'etats', label: 'Éditions des états', roles: ['CON'], items: [
    ['etats&r=ventes_jour', 'Bilans des ventes du jour'], ['etats&r=credits', 'Bilans crédits'], ['etats&r=credits_periode', 'Bilans sur période crédits'],
    ['etats&r=restes_client', 'Bilans des restes à payer par client'], ['etats&r=produits', 'Bilans produits sur période'],
    ['etats&r=clients_periode', 'Bilans clients sur période'], ['etats&r=ca_client', "Chiffres d'affaires par client"],
    ['etats&r=appros', 'Bilans approvisionnements', ['CON', 'GST']], ['point_appros', 'Point des appros par agence', ['CON', 'GST']], ['compte_agences', 'Compte agence auprès du siège (impayés, versements)', ['CON', 'GST']],
    ['etats&r=credits45', 'Bilans des crédits plus de 45 jours'], ['etats&r=paiements', 'Bilans des paiements par jour / période'],
    ['etats&r=compte_client', 'Compte client'], ['etats&r=inventaires', 'Historiques des inventaires', ['CON', 'GST']],
    ['arrets_caisse', "États d'arrêt de caisse"], ['statistiques', 'Statistique de vente par agence']] },
  { key: 'admin', label: 'ADMIN', roles: [], items: [
    ['utilisateurs', 'Utilisateurs'], ['agences', 'Paramétrage des agences'], ['fournisseurs', 'Fournisseurs'], ['whatsapp', 'Notifications WhatsApp'],
    ['messages_site', 'Messages du site web'], ['fichiers', 'Modification des fichiers (tables)'],
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
    /* Ventes et caisse : l'opérateur doit être configuré dans l'agence concernée */
    estOperateur: ag => ag === (u?.structures || ''),
    requireOperateur(ag, back) { if (ag !== (u?.structures || '')) { ctx.flash(`Action impossible : vous n'êtes pas configuré(e) dans l'agence « ${ag} ». Seuls les opérateurs de cette agence peuvent faire des ventes et des opérations de caisse.`, 'err'); ctx.redirect(back); } },
    estSiege: () => u?.structures === C.SIEGE || C.isSuper(u),
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
/* ---------- Icônes du menu (traits, 24×24) ---------- */
const ICO = {
  accueil: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  notif: '<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  siege: '<path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16"/><path d="M15 9h4a1 1 0 0 1 1 1v11M8 8h3M8 12h3M8 16h3M3 21h18"/>',
  stocks: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  ventes: '<path d="M6 3h12l1 4H5z"/><path d="M5 7v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7"/><path d="M9 11a3 3 0 0 0 6 0"/>',
  caisse: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 15h2"/>',
  etats: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  admin: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.5 14H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 3.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  chev: '<path d="m9 6 6 6-6 6"/>', guide: '<path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  out: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3"/>',
  SUP: '<path d="M12 3 4 6v6c0 5 3.4 8 8 9 4.6-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  ADM: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  RAG: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 11l2 2 4-4"/>',
  GST: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  CAI: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 15h2"/>',
  VEN: '<path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6"/><circle cx="10" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/>',
  CON: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  ok: '<circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/>', no: '<circle cx="12" cy="12" r="9"/>', menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', col: '<circle cx="12" cy="12" r="9"/><path d="m14 9-3 3 3 3"/>',
};
const ico = (k, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICO[k] || ICO.etats}</svg>`;
const SECTION = { siege: ['Siège', 'Agence Siège'], stocks: ['Stocks', 'Gestion de stocks'], ventes: ['Ventes', 'Ventes articles'], caisse: ['Caisse', 'Paiement caisse'], etats: ['Éditions', 'Éditions des états'], admin: ['Configuration', 'Administration'] };

async function layout(ctx, page, cur, content) {
  const nt = N.concerne(ctx.user) ? await N.liste(ctx.user).catch(() => null) : null;
  const s = ctx.req.session, u = ctx.user;
  const fl = s.flash || []; s.flash = [];
  const dialogs = fl.filter(f => f[0] === 'dialog').map(f => f[1]);
  const lien = (href, label, icon, actif) => `<a class="sb-link${actif ? ' on' : ''}" href="${href}" title="${e(label)}">${ico(icon)}<span>${e(label)}</span></a>`;
  let side = lien('/gestion', 'Accueil', 'accueil', page === 'accueil');
  if (nt) side += `<a class="sb-link${page === 'notifications' ? ' on' : ''}" href="/gestion?p=notifications" title="Notifications">${ico('notif')}<span>Notifications</span>${nt.rouge + nt.bleu ? `<em class="sb-badge ${nt.rouge ? 'r' : ''}">${nt.rouge + nt.bleu}</em>` : ''}</a>`;
  for (const m of MENU) {
    if (m.page) continue;
    const it = menuVisible(u, m); if (!it.length) continue;
    const act = it.some(([k]) => k === cur), [sec, lab] = SECTION[m.key] || [m.label, m.label];
    side += `<div class="sb-sec">${e(sec)}</div><div class="sb-grp${act ? ' open' : ''}"><button type="button" class="sb-link sb-tog" aria-expanded="${act}" title="${e(lab)}">${ico(m.key)}<span>${e(lab)}</span>${ico('chev', 'chev')}</button>
      <div class="sb-sub">${it.map(([k, l]) => `<a href="/gestion?p=${e(k)}"${k === cur ? ' class="on"' : ''}>${e(l)}</a>`).join('')}</div></div>`;
  }
  const affs = await C.rows('SELECT * FROM t_affectation WHERE idutilisateurs = ? ORDER BY structures <> ?, structures, niveaudacces', [u.idutilisateurs, C.SIEGE]).catch(() => []);
  const ini = String(u.nom_prenoms || u.login || '?').trim().split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase();
  const tot = nt ? nt.bleu + nt.rouge : 0;
  return `<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="csrf" content="${s.csrf}">
<title>${e(ctx.title || 'Gestion')} — KFN Pharma</title>
<meta name="theme-color" content="#14703A">
<link rel="icon" href="/assets/img/logo.png"><link rel="manifest" href="/gestion/manifest.json">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Sora:wght@600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${C.asset('/assets/css/app.css')}"><link rel="stylesheet" href="${C.asset('/assets/css/shell.css')}">
<script>try{if(localStorage.getItem('kfn-sb')==='1')document.documentElement.classList.add('sb-mini')}catch(e){}</script>
<script src="${C.asset('/assets/js/app.js')}"></script>
</head><body class="shell">
<aside class="sb" id="sb" aria-label="Menu principal">
  <div class="sb-head"><a class="sb-logo" href="/gestion"><img src="/assets/img/logo.png" alt="KFN Pharma"></a>
    <button type="button" class="sb-col" id="sbcol" title="Réduire / agrandir le menu" aria-label="Réduire le menu">${ico('col')}</button></div>
  <nav class="sb-nav">${side}</nav>
  <div class="sb-foot">${e(cfg.appTitle)}</div>
</aside>
<div class="sb-veil" id="sbveil"></div>
<div class="shell-main">
  <header class="tb">
    <button type="button" class="tb-burger" id="sbopen" aria-label="Ouvrir le menu">${ico('menu')}</button>
    <div class="tb-date">${e(C.dateLongue())}</div>
    <div class="tb-right">
      <div class="tb-roles">
        <button type="button" class="tb-role" id="rolebtn" aria-haspopup="true" aria-expanded="false" title="Travailler en tant que…">${ico(C.level(u) in ICO ? C.level(u) : 'gear')}<div><b>${e(C.NIVEAUX[C.level(u)] || C.level(u))}</b><small>${e(u.structures)}</small></div>${ico('chev', 'chev-d')}</button>
        <div class="tb-menu role-menu" id="rolemenu" hidden><div class="rm-title">Travailler en tant que</div>
        ${Object.entries(affs.reduce((g, a) => ((g[a.structures] ||= []).push(a), g), {})).map(([ag, l]) => `<div class="rm-ag">${e(ag)}</div>${l.map(a => {
          const on = a.structures === u.structures && a.niveaudacces === C.level(u);
          return `<form method="post" action="/gestion/role" data-noconfirm><input type="hidden" name="_csrf" value="${s.csrf}"><button name="id" value="${a.idaffectation}" class="rm-it${on ? ' on' : ''}"${on ? ' disabled' : ''}>
            ${ico(on ? 'ok' : 'no', 'rm-radio')}${ico(a.niveaudacces in ICO ? a.niveaudacces : 'gear')}<span>${e(C.NIVEAUX[a.niveaudacces] || a.niveaudacces)}</span>${on ? '<em>Actif</em>' : ''}</button></form>`; }).join('')}`).join('')}${affs.length > 1 ? '' : `<p class="rm-note">Une seule affectation pour ce compte. Pour travailler dans d'autres agences ou avec d'autres profils, ajoutez des lignes dans <b>ADMIN → Utilisateurs</b>${C.isAdmin(u) ? ' (<a href="/gestion?p=utilisateurs">ouvrir</a>)' : ''}.</p>`}
        </div></div>
      <a class="tb-btn" href="/gestion/guide" target="_blank" rel="noopener">${ico('guide')}<span>Guide</span></a>
      ${nt ? `<a class="tb-bell" href="/gestion?p=notifications" title="Notifications des pré-commandes" aria-label="Notifications">${ico('notif')}<b id="nbell" class="${nt.rouge ? 'r' : ''}"${tot ? '' : ' hidden'}>${tot}</b></a>` : ''}
      <div class="tb-user"><button type="button" class="tb-av" id="avbtn" aria-haspopup="true" aria-expanded="false" title="${e(u.nom_prenoms)}">${e(ini)}<i></i></button>
        <div class="tb-menu" id="avmenu" hidden><div class="tb-menu__who"><b>${e(u.nom_prenoms)}</b><small>${e(u.login)} · ${e(C.NIVEAUX[C.level(u)] || '')}</small><small>${e(u.structures)}</small></div>
          <a href="/gestion/logout">${ico('out')}Se déconnecter</a></div></div>
    </div>
  </header>
  <main class="main"${nt ? ` data-notif="${nt.bleu},${nt.rouge}"` : ''}>
${fl.filter(f => f[0] !== 'dialog').map(([t, m]) => `<div class="flash ${e(t)}">${e(m)}</div>`).join('')}
${dialogs.length ? `<script>document.addEventListener('DOMContentLoaded',function(){KFN.success(${JSON.stringify(dialogs.join('\n'))});});</script>` : ''}
${content}
  </main>
  <footer class="shell-foot">© ${new Date().getFullYear()} KFN PHARMA — ${e(cfg.appTitle)}</footer>
</div>
</body></html>`;
}

module.exports = { MENU, menuVisible, pageAllowed, Redirect, buildCtx, layout, MSG_REUSSI };
