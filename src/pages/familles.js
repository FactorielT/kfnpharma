'use strict';
const C = require('../core'); const { e } = C;
module.exports = async ctx => {
  ctx.title = 'Familles articles';
  if (ctx.req.method === 'POST') {
    const id = Number(ctx.post('id')) || 0;
    if (ctx.post('del')) {
      ctx.requireEdit('?p=familles');
      const f = await C.row('SELECT * FROM t_famille WHERE idt_famille = ?', [Number(ctx.post('del'))]);
      if (f && Number(await C.val('SELECT COUNT(*) FROM t_articles WHERE libellefa = ?', [f.libellefa]))) ctx.flash('Cette famille contient des articles : suppression impossible.', 'err');
      else if (f) { await C.q('DELETE FROM t_famille WHERE idt_famille = ?', [f.idt_famille]); ctx.flash('Famille supprimée.'); }
    } else {
      const lib = ctx.post('libelle').toUpperCase();
      if (!lib) ctx.flash('Saisissez le nom de la famille.', 'err');
      else if (Number(await C.val('SELECT COUNT(*) FROM t_famille WHERE libellefa = ? AND idt_famille <> ?', [lib, id]))) ctx.flash('Cette famille existe déjà.', 'err');
      else if (id) {
        ctx.requireEdit('?p=familles');
        await C.tx(async () => {
          const old = await C.val('SELECT libellefa FROM t_famille WHERE idt_famille = ?', [id]);
          await C.q('UPDATE t_famille SET libellefa = ? WHERE idt_famille = ?', [lib, id]);
          await C.q('UPDATE t_articles SET libellefa = ? WHERE libellefa = ?', [lib, old]);
          await C.q('UPDATE t_stock SET familearticle = ? WHERE familearticle = ?', [lib, old]);
        });
        ctx.flash(`Famille renommée en « ${lib} » (articles et stocks mis à jour).`);
      } else { await C.q('INSERT INTO t_famille (libellefa, numero) VALUES (?, (SELECT COALESCE(MAX(numero),0)+1 FROM t_famille))', [lib]); ctx.flash(`Famille « ${lib} » enregistrée.`); }
    }
    ctx.redirect('?p=familles');
  }
  const edit = ctx.get('id') && ctx.canEdit() ? await C.row('SELECT * FROM t_famille WHERE idt_famille = ?', [Number(ctx.get('id'))]) : null;
  const list = await C.rows('SELECT f.*, (SELECT COUNT(*) FROM t_articles a WHERE a.libellefa = f.libellefa) AS nb FROM t_famille f ORDER BY libellefa');
  return `<h1 class="page-title">${edit ? 'Modifier la famille' : 'Enregistrement famille articles'}</h1>
<div class="card"><form method="post" class="row" ${edit ? 'data-confirm="modify"' : ''}>${ctx.csrfField()}<input type="hidden" name="id" value="${edit?.idt_famille || 0}">
  <div class="f"><label for="lib">Famille article</label><input id="lib" name="libelle" required value="${e(edit?.libellefa)}"></div><button class="btn">${edit ? 'Modifier' : 'Valider'}</button>${edit ? '<a class="btn ghost" href="/gestion?p=familles">Annuler</a>' : ''}</form></div>
<h1 class="page-title">Listes des familles articles</h1>
<div class="card"><div class="row" style="margin-bottom:.7rem"><div class="f"><input placeholder="Rechercher une famille…" data-filter="#tf"></div></div>
<div class="tbl-wrap"><table class="tbl grey" id="tf"><thead><tr><th>Numéro</th><th>Libellé famille</th><th class="r">Articles</th>${ctx.canEdit() ? '<th></th>' : ''}</tr></thead><tbody>
${list.map(f => `<tr><td>${f.numero}</td><td><b>${e(f.libellefa)}</b></td><td class="r">${f.nb}</td>${ctx.canEdit() ? `<td class="r" style="white-space:nowrap"><a class="btn sm" href="/gestion?p=familles&id=${f.idt_famille}">Modifier</a>
  ${Number(f.nb) ? '' : `<form method="post" style="display:inline" data-confirm="delete">${ctx.csrfField()}<button class="btn red sm" name="del" value="${f.idt_famille}">Supprimer</button></form>`}</td>` : ''}</tr>`).join('')}
</tbody></table></div></div>`;
};
