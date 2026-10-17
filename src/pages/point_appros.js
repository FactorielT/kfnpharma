'use strict';
/* Point des approvisionnements par agence : une ligne = une pré-commande ; clic = détail complet */
const C = require('../core'); const { e, money, qty } = C;
const ETATS = { EN_ATTENTE: ['En attente du siège', 'o'], VALIDE_SIEGE: ['Validée — à réceptionner', 'o'], RECU_AGENCE: ['Réceptionnée', ''], PARTIEL: ['Réceptionnée en partie (retours)', 'o'], RETOURNE_SIEGE: ['Retournée au siège', 'r'] };
module.exports = async ctx => {
  ctx.title = 'Point des approvisionnements par agence';
  const liste = ctx.agences;
  let ag = ctx.get('agence'); if (!ctx.isSiege() || (ag && ag !== 'TOUTES' && !liste.includes(ag))) ag = ctx.isSiege() ? 'TOUTES' : ctx.ustruct();
  if (!ag) ag = 'TOUTES';
  const d1 = ctx.get('d1') || C.today().slice(0, 4) + '-01-01', d2 = ctx.get('d2') || C.today(), prod = ctx.get('produit'), st = ETATS[ctx.get('etat')] ? ctx.get('etat') : '';
  const ags = ag === 'TOUTES' ? liste : [ag];
  const rows = await C.rows(`SELECT idcmde, structures, MIN(dateenreg) d, MAX(utilisateur) dem, COUNT(*) n, SUM(qte) qd, SUM(qtevalidee) qa, SUM(totalvente) md, SUM(qtevalidee*pv) ma,
      MAX(datevalidation) dv, MAX(datereception) dr,
      CASE WHEN BOOL_OR(statut = 'EN_ATTENTE') THEN 'EN_ATTENTE' WHEN BOOL_OR(statut = 'VALIDE_SIEGE') THEN 'VALIDE_SIEGE'
           WHEN BOOL_AND(statut = 'RECU_AGENCE') THEN 'RECU_AGENCE' WHEN BOOL_AND(statut = 'RETOURNE_SIEGE') THEN 'RETOURNE_SIEGE' ELSE 'PARTIEL' END etat
    FROM t_precommandeagence WHERE structures = ANY(?) AND dateenreg BETWEEN ? AND ?
      AND (?::text = '' OR idcmde IN (SELECT idcmde FROM t_precommandeagence WHERE libarticles = ?))
    GROUP BY idcmde, structures ORDER BY MIN(dateenreg) DESC, idcmde DESC`, [ags, d1, d2, prod, prod]);
  const list = st ? rows.filter(r => r.etat === st) : rows;
  const produits = (await C.rows('SELECT DISTINCT libarticles FROM t_precommandeagence WHERE structures = ANY(?) ORDER BY libarticles', [ags])).map(r => r.libarticles);
  const sum = Object.fromEntries(Object.keys(ETATS).map(k => [k, rows.filter(r => r.etat === k)]));
  return `<h1 class="page-title">Point des approvisionnements par agence</h1>
<div class="card no-print"><form method="get" action="/gestion" class="row"><input type="hidden" name="p" value="point_appros">
  <div class="f"><label>Agence</label><select name="agence">${ctx.isSiege() ? `<option value="TOUTES"${ag === 'TOUTES' ? ' selected' : ''}>Toutes les agences</option>` : ''}${ctx.agOptions(ag, false, true)}</select></div>
  <div class="f"><label>Date début</label><input type="date" name="d1" value="${e(d1)}"></div><div class="f"><label>Date fin</label><input type="date" name="d2" value="${e(d2)}"></div>
  <div class="f"><label>Produit</label><select name="produit">${C.selOptions(produits, prod, true, 'Tous les produits')}</select></div>
  <div class="f"><label>État</label><select name="etat"><option value="">Tous</option>${Object.entries(ETATS).map(([k, s]) => `<option value="${k}"${st === k ? ' selected' : ''}>${s[0]}</option>`).join('')}</select></div>
  <button class="btn" style="background:#0000C8">Afficher</button><button type="button" class="btn green" data-print>Imprimer</button><button type="button" class="btn ghost" data-export="#tp" data-name="point-appros">Exporter (Excel)</button></form></div>
<div class="card"><p class="hint" style="margin-top:0">${e(ag === 'TOUTES' ? 'Toutes les agences' : ag)} — du ${C.dfr(d1)} au ${C.dfr(d2)}${prod ? ' — produit : <b>' + e(prod) + '</b>' : ''}</p>
  <div class="kpis">${Object.entries(ETATS).map(([k, s]) => `<a class="kpi ${s[1]}" style="text-decoration:none;color:inherit" href="/gestion?p=point_appros&agence=${encodeURIComponent(ag)}&d1=${d1}&d2=${d2}&produit=${encodeURIComponent(prod)}&etat=${k}"><small>${s[0]}</small><b>${sum[k].length}</b><small>${money(sum[k].reduce((a, r) => a + Number(k === 'EN_ATTENTE' ? r.md : r.ma), 0))} FCFA</small></a>`).join('')}</div>
  <div class="tbl-wrap"><table class="tbl grey" id="tp"><thead><tr><th>N° pré-commande</th><th>Date</th><th>Agence</th><th class="r">Articles</th><th class="r">Qté demandée</th><th class="r">Qté accordée</th><th class="r">Montant demandé</th><th class="r">Montant accordé</th><th>État</th><th>Validée le</th><th>Reçue le</th></tr></thead><tbody>
  ${list.map(r => { const s = ETATS[r.etat]; return `<tr class="click" data-detail="type=precmd&num=${encodeURIComponent(r.idcmde)}" title="Voir le détail"><td><b>${e(r.idcmde)}</b></td><td>${C.dfr(r.d)}</td><td>${e(r.structures)}</td><td class="r">${r.n}</td><td class="r">${qty(r.qd)}</td><td class="r">${r.etat === 'EN_ATTENTE' ? '—' : qty(r.qa)}</td>
    <td class="r">${money(r.md)}</td><td class="r">${r.etat === 'EN_ATTENTE' ? '—' : money(r.ma)}</td><td><span class="badge ${s[1]}">${s[0]}</span></td><td>${C.dfr(r.dv)}</td><td>${C.dfr(r.dr)}</td></tr>`; }).join('') || '<tr><td colspan="11" class="empty">Aucune pré-commande sur cette sélection.</td></tr>'}</tbody></table></div>
  <p class="hint no-print">Une ligne = une pré-commande. Touchez une ligne pour voir son détail complet (articles, quantités demandées et accordées, état de chaque article, dates).</p></div>
<script>document.querySelectorAll('tr[data-detail]').forEach(function(tr){tr.addEventListener('click',function(){KFN.details(tr.dataset.detail);});});</script>`;
};
