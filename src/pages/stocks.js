'use strict';
const C = require('../core'); const { e, money, qty, num } = C;
module.exports = async ctx => {
  ctx.title = 'Stocks articles';
  const ag = ctx.agenceOk(ctx.get('agence') || ctx.post('agence'));
  const prixMode = !!ctx.get('prix') && ctx.canEdit();
  if (ctx.req.method === 'POST') {
    ctx.requireEdit('?p=stocks&agence=' + encodeURIComponent(ag));
    const pa = ctx.B.pa || {}, pv = ctx.B.pv || {}, al = ctx.B.al || {}; let n = 0;
    await C.tx(async () => { for (const k of Object.keys(pa)) n += (await C.q('UPDATE t_stock SET prixachat = ?, prixvente = ?, quantitealerte = ? WHERE idt_stock = ? AND structures = ? AND (prixachat <> ? OR prixvente <> ? OR quantitealerte <> ?)', [Math.round(num(pa[k])), Math.round(num(pv[k])), num(al[k]), Number(k.slice(1)), ag, Math.round(num(pa[k])), Math.round(num(pv[k])), num(al[k])])).rowCount; });
    ctx.flash(`${n} prix modifié(s) pour ${ag}.`);
    ctx.redirect('?p=stocks&prix=1&agence=' + encodeURIComponent(ag));
  }
  const list = await C.rows('SELECT * FROM t_stock WHERE structures = ? ORDER BY libarticles', [ag]);
  const valeur = list.reduce((s, x) => s + Math.max(0, x.quantitestock) * x.prixvente, 0);
  return `<h1 class="page-title">${prixMode ? 'Modifier les prix de vente — ' + e(ag) : 'Visibilité du stock'}</h1>
<div class="card"><form method="get" action="/gestion" class="row"><input type="hidden" name="p" value="stocks">${prixMode ? '<input type="hidden" name="prix" value="1">' : ''}
  <div class="f"><label>Agence</label><select name="agence" data-autosubmit>${ctx.agOptions(ag)}</select></div>
  <div class="f"><label>Rechercher</label><input placeholder="Article, référence…" data-filter="#ts"></div>
  <div class="kpi" style="padding:.4rem .8rem"><small>Nombre d'articles</small><b>${list.length}</b></div>
  <div class="kpi b" style="padding:.4rem .8rem"><small>Valeur du stock (prix vente)</small><b>${money(valeur)}</b></div>
  ${ctx.canEdit() ? (prixMode ? `<a class="btn ghost" href="/gestion?p=stocks&agence=${encodeURIComponent(ag)}">Retour</a>` : `<a class="btn" href="/gestion?p=stocks&prix=1&agence=${encodeURIComponent(ag)}">Modifier les prix</a>`) : ''}
  <button type="button" class="btn ghost" data-export="#ts" data-name="stock-${e(ag)}">Exporter</button></form></div>
<form method="post" class="card" data-confirm="modify">${ctx.csrfField()}<input type="hidden" name="agence" value="${e(ag)}">
  ${prixMode ? '<p class="hint" style="text-align:center;font-weight:800">Chaque agence a ses propres prix : seuls le prix d\'achat, le prix de vente et la quantité d\'alerte sont modifiables ici.</p>' : ''}
  <div class="tbl-wrap"><table class="tbl grey" id="ts"><thead><tr><th>Référence</th><th>Code articles</th><th>Libellé articles</th><th class="r">Quantités stock</th><th>Unité</th><th class="r">Prix achat</th><th class="r">Prix vente</th><th class="r">Qté alerte</th></tr></thead><tbody>
  ${list.map(s => `<tr><td>${e(s.refarticles)}</td><td>${e(s.codearticles)}</td><td>${e(s.libarticles)}</td>
    <td class="r ${s.quantitestock < 0 ? 'neg' : ''}">${qty(s.quantitestock)}${s.quantitestock <= s.quantitealerte ? ' <span class="badge r">alerte</span>' : ''}</td><td>${e(s.unitevaleur)}</td>
    ${prixMode ? `<td class="edit" style="background:#00BFBF"><input name="pa[i${s.idt_stock}]" value="${s.prixachat}" inputmode="numeric"></td><td class="edit" style="background:#9BEA8E"><input name="pv[i${s.idt_stock}]" value="${s.prixvente}" inputmode="numeric"></td><td class="edit"><input name="al[i${s.idt_stock}]" value="${s.quantitealerte}" inputmode="decimal"></td>`
      : `<td class="r">${money(s.prixachat)}</td><td class="r">${money(s.prixvente)}</td><td class="r">${qty(s.quantitealerte)}</td>`}</tr>`).join('') || '<tr><td colspan="8" class="empty">Aucun article dans le stock de cette agence. Le siège peut le générer dans « Enregistrement du stock ».</td></tr>'}
  </tbody></table></div>${prixMode && list.length ? '<div class="actions"><button class="btn green">Enregistrer les prix</button></div>' : ''}</form>`;
};
