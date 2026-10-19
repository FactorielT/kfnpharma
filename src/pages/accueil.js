'use strict';
const C = require('../core'); const { e, money, qty } = C;
module.exports = async ctx => {
  ctx.title = 'Accueil';
  const ags = ctx.agences, inn = ags.map(() => '?').join(',');
  const [ventes, enc1, enc2, credits, alertes, nbAl, rec] = await Promise.all([
    C.val(`SELECT COALESCE(SUM(mtapayer),0) FROM t_commande WHERE datecmde = CURRENT_DATE AND structures IN (${inn})`, ags),
    C.val(`SELECT COALESCE(SUM(verse),0) FROM t_paiement WHERE datepaiement = CURRENT_DATE AND structures IN (${inn})`, ags),
    C.val(`SELECT COALESCE(SUM(verse),0) FROM t_paiement_sl WHERE datepaiement = CURRENT_DATE AND structures IN (${inn})`, ags),
    C.val(`SELECT COALESCE(SUM(reste),0) FROM t_commande WHERE reste > 0 AND structures IN (${inn})`, ags),
    C.rows(`SELECT structures, libarticles, quantitestock, quantitealerte FROM t_stock WHERE quantitestock <= quantitealerte AND activer = 1 AND structures IN (${inn}) ORDER BY quantitestock LIMIT 12`, ags),
    C.val(`SELECT COUNT(*) FROM t_stock WHERE quantitestock <= quantitealerte AND activer = 1 AND structures IN (${inn})`, ags),
    C.val(`SELECT COUNT(DISTINCT idcmde) FROM t_precommandeagence WHERE statut = 'VALIDE_SIEGE' AND structures IN (${inn})`, ags)]);
  const pend = ctx.isSiege() ? await C.val("SELECT COUNT(DISTINCT idcmde) FROM t_precommandeagence WHERE statut = 'EN_ATTENTE'") : 0;
  const msgs = ctx.isAdmin() ? await C.val('SELECT COUNT(*) FROM site_messages_contact WHERE lu = 0') : 0;
  const kpiLink = (cls, href, t, v) => `<a class="kpi ${cls}" href="${href}" style="text-decoration:none;color:inherit"><small>${t}</small><b>${v}</b></a>`;
  return `<div class="card home-hero welcome"><div><h2><svg class="ico" viewBox="0 0 24 24" style="width:26px;height:26px"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>Accueil</h2>
    <p>Bienvenue, <b>${e(ctx.uname())}</b>. — Agence : <b>${e(ctx.ustruct())}</b> · Profil : ${e(C.NIVEAUX[ctx.level()] || ctx.level())}</p>
    <p class="hint">Utilisez le menu à gauche pour accéder aux modules de l'application.</p>
    <div class="actions" style="justify-content:flex-start">
      ${ctx.pageAllowed('facture') ? '<a class="btn orange" href="/gestion?p=facture">Nouvelle facture</a>' : ''}
      ${ctx.pageAllowed('caisse_jour') ? '<a class="btn green" href="/gestion?p=caisse_jour">Encaisser</a>' : ''}
      ${ctx.pageAllowed('precommande') ? '<a class="btn" href="/gestion?p=precommande">Pré-commande</a>' : ''}
      ${ctx.pageAllowed('statistiques') ? '<a class="btn ghost" href="/gestion?p=statistiques">Statistiques</a>' : ''}
    </div></div><img src="/assets/img/app-tensio.jpg" alt=""></div>
  <div class="kpis">
    <div class="kpi"><small>Ventes du jour</small><b>${money(ventes)} FCFA</b></div>
    <div class="kpi b"><small>Encaissé aujourd'hui</small><b>${money(Number(enc1) + Number(enc2))} FCFA</b></div>
    <div class="kpi r"><small>Crédits clients en cours</small><b>${money(credits)} FCFA</b></div>
    <div class="kpi o"><small>Articles en alerte de stock</small><b>${nbAl}</b></div>
    ${ctx.isSiege() ? kpiLink('o', '/gestion?p=appro_agences', 'Pré-commandes à valider (siège)', pend) : ''}
    ${ctx.isAdmin() ? kpiLink('', '/gestion?p=messages_site', 'Messages du site non lus', msgs) : ''}
    ${ctx.pageAllowed('reception_appro') ? kpiLink('b', '/gestion?p=reception_appro', 'Approvisionnements à réceptionner', rec) : ''}
  </div>
  <div class="card"><h2>Stocks en alerte</h2><div class="tbl-wrap"><table class="tbl grey">
    <thead><tr><th>Agence</th><th>Article</th><th class="r">Stock</th><th class="r">Seuil d'alerte</th></tr></thead><tbody>
    ${alertes.map(a => `<tr><td>${e(a.structures)}</td><td>${e(a.libarticles)}</td><td class="r ${a.quantitestock < 0 ? 'neg' : ''}">${qty(a.quantitestock)}</td><td class="r">${qty(a.quantitealerte)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Aucun article sous le seuil d\'alerte.</td></tr>'}
  </tbody></table></div></div>`;
};
