'use strict';
const C = require('../core'); const { e, money, num } = C;
module.exports = async ctx => {
  ctx.title = 'Objectif par agence';
  if (ctx.req.method === 'POST') {
    if (ctx.post('del')) { await C.q('DELETE FROM objectif WHERE idobjectif = ?', [Number(ctx.post('del'))]); ctx.flash('Objectif supprimé.'); ctx.redirect('?p=objectifs'); }
    const ag = ctx.agenceOk(ctx.post('agence')), an = ctx.post('annee').replace(/\D/g, ''), m = Math.round(num(ctx.post('montant')));
    if (!an || m <= 0) ctx.flash('Saisissez l’année et le montant.', 'err');
    else {
      const id = await C.val('SELECT idobjectif FROM objectif WHERE structuresannee = ?', [ag + an]);
      if (id) await C.q('UPDATE objectif SET montant = ? WHERE idobjectif = ?', [m, id]);
      else await C.q('INSERT INTO objectif (annee, montant, structures, structuresannee) VALUES (?,?,?,?)', [an, m, ag, ag + an]);
      ctx.flash(`Objectif ${an} de ${ag} : ${money(m)} FCFA.`);
    }
    ctx.redirect('?p=objectifs');
  }
  const list = await C.rows('SELECT * FROM objectif ORDER BY annee DESC, structures');
  return `<h1 class="page-title">Objectif par agence</h1>
<div class="card"><form method="post" class="row">${ctx.csrfField()}<div class="f"><label>Agence</label><select name="agence">${ctx.agOptions()}</select></div>
  <div class="f"><label>Année</label><input name="annee" value="${new Date().getFullYear()}" inputmode="numeric"></div><div class="f"><label>Montant</label><input name="montant" class="num" inputmode="numeric" required></div><button class="btn green">Valider</button></form></div>
<div class="card"><div class="tbl-wrap"><table class="tbl grey"><thead><tr><th>N°</th><th>Structures</th><th>Année</th><th class="r">Montant</th><th></th></tr></thead><tbody>
${list.map((o, i) => `<tr><td>${i + 1}</td><td>${e(o.structures)}</td><td>${e(o.annee)}</td><td class="r">${money(o.montant)}</td><td class="r"><form method="post" data-confirm="delete">${ctx.csrfField()}<button class="btn red sm" name="del" value="${o.idobjectif}">×</button></form></td></tr>`).join('')}</tbody></table></div></div>`;
};
