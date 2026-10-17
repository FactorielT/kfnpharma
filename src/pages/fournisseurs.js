'use strict';
const C = require('../core'); const { e } = C;
module.exports = async ctx => {
  ctx.title = 'Fournisseurs';
  if (ctx.req.method === 'POST') {
    const id = Number(ctx.post('id')) || 0;
    if (ctx.post('del')) { ctx.requireEdit('?p=fournisseurs'); await C.q('DELETE FROM t_fournisseur WHERE idt_fournisseur = ?', [Number(ctx.post('del'))]); ctx.flash('Fournisseur supprimé.'); }
    else if (!ctx.post('fournisseur')) ctx.flash('Saisissez le nom du fournisseur.', 'err');
    else if (id) { ctx.requireEdit('?p=fournisseurs'); await C.q('UPDATE t_fournisseur SET fournisseur = ?, localite = ?, contact = ? WHERE idt_fournisseur = ?', [ctx.post('fournisseur').toUpperCase(), ctx.post('localite'), ctx.post('contact'), id]); ctx.flash('Fournisseur modifié.'); }
    else { await C.q('INSERT INTO t_fournisseur (fournisseur, localite, contact) VALUES (?,?,?)', [ctx.post('fournisseur').toUpperCase(), ctx.post('localite'), ctx.post('contact')]); ctx.flash('Fournisseur enregistré.'); }
    ctx.redirect('?p=fournisseurs');
  }
  const edit = ctx.get('id') && ctx.canEdit() ? await C.row('SELECT * FROM t_fournisseur WHERE idt_fournisseur = ?', [Number(ctx.get('id'))]) : null;
  const list = await C.rows('SELECT * FROM t_fournisseur ORDER BY fournisseur');
  return `<h1 class="page-title">${edit ? 'Modifier le fournisseur' : 'Enregistrement fournisseur'}</h1>
<div class="card"><form method="post" class="row" ${edit ? 'data-confirm="modify"' : ''}>${ctx.csrfField()}<input type="hidden" name="id" value="${edit?.idt_fournisseur || 0}">
  <div class="f"><label>Fournisseur</label><input name="fournisseur" required value="${e(edit?.fournisseur)}"></div><div class="f"><label>Localité</label><input name="localite" value="${e(edit?.localite)}"></div>
  <div class="f"><label>Contact</label><input name="contact" inputmode="tel" value="${e(edit?.contact)}"></div><button class="btn">${edit ? 'Modifier' : 'Valider'}</button>${edit ? '<a class="btn ghost" href="/gestion?p=fournisseurs">Annuler</a>' : ''}</form></div>
<div class="card"><div class="tbl-wrap"><table class="tbl grey"><thead><tr><th>Fournisseur</th><th>Localité</th><th>Contact</th>${ctx.canEdit() ? '<th></th>' : ''}</tr></thead><tbody>
${list.map(f => `<tr><td>${e(f.fournisseur)}</td><td>${e(f.localite)}</td><td>${e(f.contact)}</td>${ctx.canEdit() ? `<td class="r" style="white-space:nowrap"><a class="btn sm" href="/gestion?p=fournisseurs&id=${f.idt_fournisseur}">Modifier</a>
  <form method="post" style="display:inline" data-confirm="delete">${ctx.csrfField()}<button class="btn red sm" name="del" value="${f.idt_fournisseur}">Supprimer</button></form></td>` : ''}</tr>`).join('')}
</tbody></table></div></div>`;
};
