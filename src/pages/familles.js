'use strict';
const C = require('../core'); const { e } = C;
module.exports = async ctx => {
  ctx.title = 'Familles articles';
  if (ctx.req.method === 'POST') {
    if (ctx.post('del')) { await C.q('DELETE FROM t_famille WHERE idt_famille = ?', [Number(ctx.post('del'))]); ctx.flash('Famille supprimée.'); }
    else {
      const lib = ctx.post('libelle').toUpperCase();
      if (!lib) ctx.flash('Saisissez le nom de la famille.', 'err');
      else if (Number(await C.val('SELECT COUNT(*) FROM t_famille WHERE libellefa = ?', [lib]))) ctx.flash('Cette famille existe déjà.', 'err');
      else { await C.q('INSERT INTO t_famille (libellefa, numero) VALUES (?, (SELECT COALESCE(MAX(numero),0)+1 FROM t_famille))', [lib]); ctx.flash(`Famille « ${lib} » enregistrée.`); }
    }
    ctx.redirect('?p=familles');
  }
  const list = await C.rows('SELECT f.*, (SELECT COUNT(*) FROM t_articles a WHERE a.libellefa = f.libellefa) AS nb FROM t_famille f ORDER BY libellefa');
  return `<h1 class="page-title">Enregistrement famille articles</h1>
<div class="card"><form method="post" class="row">${ctx.csrfField()}
  <div class="f"><label for="lib">Famille article</label><input id="lib" name="libelle" required></div><button class="btn">Valider</button></form></div>
<h1 class="page-title">Listes des familles articles</h1>
<div class="card"><div class="row" style="margin-bottom:.7rem"><div class="f"><input placeholder="Rechercher une famille…" data-filter="#tf"></div></div>
<div class="tbl-wrap"><table class="tbl grey" id="tf"><thead><tr><th>Numéro</th><th>Libellé famille</th><th class="r">Articles</th><th></th></tr></thead><tbody>
${list.map(f => `<tr><td>${f.numero}</td><td><b>${e(f.libellefa)}</b></td><td class="r">${f.nb}</td><td class="r">${Number(f.nb) ? '' : `<form method="post" data-confirm="delete">${ctx.csrfField()}<button class="btn red sm" name="del" value="${f.idt_famille}">Supprimer</button></form>`}</td></tr>`).join('')}
</tbody></table></div></div>`;
};
