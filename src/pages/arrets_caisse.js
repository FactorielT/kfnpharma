'use strict';
const C = require('../core'); const { e, money } = C;
module.exports = async ctx => {
  ctx.title = "États d'arrêt de caisse";
  const ag = ctx.agenceOk(ctx.get('agence')), d1 = ctx.get('d1') || C.today().slice(0, 8) + '01', d2 = ctx.get('d2') || C.today();
  const list = await C.rows('SELECT * FROM t_fermercaisse WHERE structures = ? AND datefermer BETWEEN ? AND ? ORDER BY datefermer DESC', [ag, d1, d2]);
  const s = k => list.reduce((a, x) => a + Number(x[k]), 0);
  return `<h1 class="page-title">États des arrêts de caisse</h1>
<div class="card"><form method="get" action="/gestion" class="row"><input type="hidden" name="p" value="arrets_caisse"><div class="f"><label>Agence</label><select name="agence">${ctx.agOptions(ag)}</select></div>
  <div class="f"><label>Date début</label><input type="date" name="d1" value="${e(d1)}"></div><div class="f"><label>Date fin</label><input type="date" name="d2" value="${e(d2)}"></div>
  <button class="btn" style="background:#0000C8">Afficher</button><button type="button" class="btn orange" data-print style="font-style:italic">Imprimer</button></form></div>
<div class="card"><div class="tbl-wrap"><table class="tbl grey"><thead><tr><th>Date fermeture</th><th class="r">Montant encaissé jour</th><th class="r">Montant dépense jour</th><th class="r">Valeur logiciel caisse</th><th class="r">Valeur physique caisse</th><th class="r">Écart</th><th>Utilisateur</th><th>Caisse fermée</th></tr></thead><tbody>
${list.map(f => `<tr><td>${C.dfr(f.datefermer)}</td><td class="r">${money(f.cumulcaissejour)}</td><td class="r">${money(f.caissedepensejour)}</td><td class="r">${money(f.valeurlogicielcaissejour)}</td><td class="r">${money(f.valeurphysiquecaissejour)}</td><td class="r ${f.ecart < 0 ? 'neg' : ''}">${money(f.ecart)}</td><td>${e(f.utilisateur)}</td><td>${f.caissefermee ? 'Oui' : 'Non'}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">Aucun arrêt de caisse sur la période.</td></tr>'}</tbody>
${list.length ? `<tfoot><tr><td>Total</td><td class="r">${money(s('cumulcaissejour'))}</td><td class="r">${money(s('caissedepensejour'))}</td><td class="r">${money(s('valeurlogicielcaissejour'))}</td><td class="r">${money(s('valeurphysiquecaissejour'))}</td><td class="r">${money(s('ecart'))}</td><td colspan="2"></td></tr></tfoot>` : ''}</table></div></div>`;
};
