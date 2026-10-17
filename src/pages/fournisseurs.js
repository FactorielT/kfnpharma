'use strict';
const C = require('../core'); const { e } = C;
module.exports = async ctx => {
  ctx.title = 'Fournisseurs';
  if (ctx.req.method === 'POST') {
    if (ctx.post('del')) { await C.q('DELETE FROM t_fournisseur WHERE idt_fournisseur = ?', [Number(ctx.post('del'))]); ctx.flash('Fournisseur supprimé.'); }
    else if (!ctx.post('fournisseur')) ctx.flash('Saisissez le nom du fournisseur.', 'err');
    else { await C.q('INSERT INTO t_fournisseur (fournisseur, localite, contact) VALUES (?,?,?)', [ctx.post('fournisseur').toUpperCase(), ctx.post('localite'), ctx.post('contact')]); ctx.flash('Fournisseur enregistré.'); }
    ctx.redirect('?p=fournisseurs');
  }
  const list = await C.rows('SELECT * FROM t_fournisseur ORDER BY fournisseur');
  return `<h1 class="page-title">Enregistrement fournisseur</h1>
<div class="card"><form method="post" class="row">${ctx.csrfField()}
  <div class="f"><label>Fournisseur</label><input name="fournisseur" required></div><div class="f"><label>Localité</label><input name="localite"></div>
  <div class="f"><label>Contact</label><input name="contact" inputmode="tel"></div><button class="btn">Valider</button></form></div>
<div class="card"><div class="tbl-wrap"><table class="tbl grey"><thead><tr><th>Fournisseur</th><th>Localité</th><th>Contact</th><th></th></tr></thead><tbody>
${list.map(f => `<tr><td>${e(f.fournisseur)}</td><td>${e(f.localite)}</td><td>${e(f.contact)}</td><td class="r"><form method="post" data-confirm="delete">${ctx.csrfField()}<button class="btn red sm" name="del" value="${f.idt_fournisseur}">Supprimer</button></form></td></tr>`).join('')}
</tbody></table></div></div>`;
};
