'use strict';
const C = require('../core'); const { e, money, qty } = C;
const STATUTS = { RECU_AGENCE: ["Validé et réceptionné par l'agence", ''], VALIDE_SIEGE: ['Validé siège — non réceptionné', 'o'], EN_ATTENTE: ['Non validé — en attente du siège', 'o'], RETOURNE_SIEGE: ["Non validé par l'agence — retourné au siège", 'r'] };
module.exports = async ctx => {
  ctx.title = 'Point des approvisionnements par agence';
  const liste = ctx.agences;
  let ag = ctx.get('agence');
  if (!ctx.isSiege() || (ag && ag !== 'TOUTES' && !liste.includes(ag))) ag = ctx.isSiege() ? '' : ctx.ustruct();
  const an = ctx.get('annee').replace(/\D/g, ''), st = ctx.get('statut');
  const w = [], p = [];
  if (!ag || ag === 'TOUTES') { w.push(`structures IN (${liste.map(() => '?').join(',')})`); p.push(...liste); } else { w.push('structures = ?'); p.push(ag); }
  if (an) { w.push('EXTRACT(YEAR FROM dateenreg) = ?'); p.push(Number(an)); }
  if (STATUTS[st]) { w.push('statut = ?'); p.push(st); }
  const lignes = await C.rows(`SELECT * FROM t_precommandeagence WHERE ${w.join(' AND ')} ORDER BY dateenreg DESC, idcmde DESC, idprecommandeagence`, p);
  const annees = (await C.rows('SELECT DISTINCT EXTRACT(YEAR FROM dateenreg)::int a FROM t_precommandeagence WHERE dateenreg IS NOT NULL ORDER BY a DESC')).map(r => String(r.a));
  const parAn = {}; for (const l of lignes) (parAn[String(l.dateenreg).slice(0, 4)] ||= []).push(l);
  const mt = l => (l.statut === 'EN_ATTENTE' ? l.qte : l.qtevalidee) * l.pv;
  let h = `<h1 class="page-title">Point des approvisionnements par agence</h1>
<div class="card no-print"><form method="get" action="/gestion" class="row"><input type="hidden" name="p" value="point_appros">
  <div class="f"><label>Agence</label><select name="agence">${ctx.isSiege() ? '<option value="TOUTES">Toutes les agences</option>' : ''}${ctx.agOptions(ag, false, true)}</select></div>
  <div class="f"><label>Année</label><select name="annee">${C.selOptions(annees, an, true, 'Toutes les années')}</select></div>
  <div class="f"><label>État</label><select name="statut"><option value="">Tous (validés et non validés)</option>${Object.entries(STATUTS).map(([k, s]) => `<option value="${k}"${st === k ? ' selected' : ''}>${e(s[0])}</option>`).join('')}</select></div>
  <button class="btn" style="background:#0000C8">Afficher</button><button type="button" class="btn green" data-print>Imprimer</button><button type="button" class="btn ghost" data-export="#tp" data-name="point-appros">Exporter (Excel)</button></form></div><div id="tp">`;
  if (!lignes.length) h += '<div class="card"><p class="empty hint">Aucun approvisionnement sur cette sélection.</p></div>';
  for (const annee of Object.keys(parAn).sort().reverse()) {
    const ls = parAn[annee], sum = Object.fromEntries(Object.keys(STATUTS).map(k => [k, { n: 0, m: 0 }]));
    for (const l of ls) if (sum[l.statut]) { sum[l.statut].n++; sum[l.statut].m += mt(l); }
    h += `<h1 class="page-title" style="background:var(--green-d)">Année ${e(annee)}</h1><div class="card"><div class="kpis">${Object.entries(STATUTS).map(([k, s]) => `<div class="kpi ${s[1]}"><small>${e(s[0])}</small><b>${money(sum[k].m)}</b><small>${sum[k].n} ligne(s)</small></div>`).join('')}</div>
    <div class="tbl-wrap"><table class="tbl grey"><thead><tr><th>Date demande</th><th>N° pré-commande</th><th>Agence</th><th>Article</th><th class="r">Demandé</th><th class="r">Accordé</th><th class="r">Montant</th><th>État</th><th>Validé siège le</th><th>Réception / retour</th></tr></thead><tbody>
    ${ls.map(l => { const s = STATUTS[l.statut] || [l.statut, 'o']; return `<tr><td>${C.dfr(l.dateenreg)}</td><td>${e(l.idcmde)}</td><td>${e(l.structures)}</td><td>${e(l.libarticles)}</td><td class="r">${qty(l.qte)}</td><td class="r">${l.statut === 'EN_ATTENTE' ? '—' : qty(l.qtevalidee)}</td><td class="r">${money(mt(l))}</td>
      <td><span class="badge ${s[1]}">${e(s[0])}</span></td><td>${C.dfr(l.datevalidation)}${l.validepar ? ' — ' + e(l.validepar) : ''}</td><td>${C.dfr(l.datereception)}${l.recupar ? ' — ' + e(l.recupar) : ''}</td></tr>`; }).join('')}</tbody></table></div></div>`;
  }
  return h + '</div>';
};
