'use strict';
const C = require('../core'); const { e, money, num } = C;
module.exports = async ctx => {
  ctx.title = 'Articles';
  if (ctx.req.method === 'POST') {
    const id = Number(ctx.post('id')) || 0;
    const d = { fam: ctx.post('famille'), ref: ctx.post('ref').toUpperCase(), lib: ctx.post('lib').toUpperCase(), u: ctx.post('unite') || 'Unité', pa: Math.round(num(ctx.post('pa'))), pv: Math.round(num(ctx.post('pv'))), pp: Math.round(num(ctx.post('pp'))) };
    if (ctx.post('del')) {
      const a = await C.row('SELECT * FROM t_articles WHERE idt_articles = ?', [Number(ctx.post('del'))]);
      if (a && Number(await C.val('SELECT COUNT(*) FROM t_lignecmde WHERE refarticles = ?', [a.refarticles]))) ctx.flash('Article déjà vendu : suppression impossible.', 'err');
      else if (a) { await C.tx(async () => { await C.q('DELETE FROM t_articles WHERE idt_articles = ?', [a.idt_articles]); await C.q('DELETE FROM t_stock WHERE refarticles = ? AND quantitestock = 0', [a.refarticles]); }); ctx.flash('Article supprimé.'); }
    } else if (!d.ref || !d.lib || !d.fam) ctx.flash('Renseignez la famille, la référence et le libellé.', 'err');
    else if (Number(await C.val('SELECT COUNT(*) FROM t_articles WHERE refarticles = ? AND idt_articles <> ?', [d.ref, id]))) ctx.flash(`La référence ${d.ref} existe déjà.`, 'err');
    else await C.tx(async () => {
      if (id) {
        const old = await C.row('SELECT refarticles FROM t_articles WHERE idt_articles = ?', [id]);
        await C.q('UPDATE t_articles SET libellefa=?, refarticles=?, libarticles=?, unitevaleur=?, prixachat=?, prixvente=?, prixpromo=? WHERE idt_articles=?', [d.fam, d.ref, d.lib, d.u, d.pa, d.pv, d.pp, id]);
        await C.q('UPDATE t_stock SET refarticles=?, libarticles=?, unitevaleur=?, familearticle=?, codearticles = structures || ? WHERE refarticles=?', [d.ref, d.lib, d.u, d.fam, d.ref, old.refarticles]);
        ctx.flash('Article modifié.');
      } else {
        await C.q('INSERT INTO t_articles (libellefa, refarticles, libarticles, unitevaleur, prixachat, prixvente, prixpromo) VALUES (?,?,?,?,?,?,?)', [d.fam, d.ref, d.lib, d.u, d.pa, d.pv, d.pp]);
        if (!await C.stockRow(C.SIEGE, d.ref)) await C.stockMove(C.SIEGE, d.ref, 0, { libarticles: d.lib, unitevaleur: d.u, familearticle: d.fam, prixachat: d.pa, prixvente: d.pv });
        ctx.flash(`Article « ${d.lib} » enregistré et ajouté au stock du siège.`);
      }
    });
    ctx.redirect('?p=articles');
  }
  const edit = ctx.get('id') ? await C.row('SELECT * FROM t_articles WHERE idt_articles = ?', [Number(ctx.get('id'))]) : null;
  const fams = (await C.rows('SELECT libellefa FROM t_famille ORDER BY libellefa')).map(r => r.libellefa);
  const list = await C.rows('SELECT * FROM t_articles ORDER BY libarticles');
  return `<h1 class="page-title">${edit ? 'Modification article' : 'Enregistrement articles'}</h1>
<div class="card"><form method="post" class="grid g4" ${edit ? 'data-confirm="modify"' : ''}>${ctx.csrfField()}<input type="hidden" name="id" value="${edit?.idt_articles || 0}">
  <div class="f"><label>Famille article</label><select name="famille" required>${C.selOptions(fams, edit?.libellefa)}</select></div>
  <div class="f"><label>Réf. article</label><input name="ref" required value="${e(edit?.refarticles)}"></div>
  <div class="f"><label>Article</label><input name="lib" required value="${e(edit?.libarticles)}"></div>
  <div class="f"><label>Unité valeur</label><input name="unite" placeholder="Ex : Unité, Kg, L, Mètre, Pot…" value="${e(edit?.unitevaleur || 'Unité')}"></div>
  <div class="f"><label>Prix achat</label><input name="pa" class="num" inputmode="numeric" value="${edit?.prixachat || 0}"></div>
  <div class="f"><label>Prix vente</label><input name="pv" class="num" inputmode="numeric" value="${edit?.prixvente || 0}"></div>
  <div class="f"><label>Prix promo</label><input name="pp" class="num" inputmode="numeric" value="${edit?.prixpromo || 0}"></div>
  <div class="f" style="display:flex;gap:.5rem;align-items:flex-end"><button class="btn">${edit ? 'Modifier' : 'Valider'}</button>${edit ? '<a class="btn ghost" href="/gestion?p=articles">Annuler</a>' : ''}</div>
</form></div>
<h1 class="page-title">Listes des articles (${list.length})</h1>
<div class="card"><div class="row" style="margin-bottom:.7rem"><div class="f"><input placeholder="Rechercher un article, une référence, une famille…" data-filter="#ta"></div>
<button class="btn ghost" data-export="#ta" data-name="articles">Exporter (Excel)</button></div>
<div class="tbl-wrap"><table class="tbl grey" id="ta"><thead><tr><th>Famille</th><th>Référence</th><th>Libellé</th><th>Unité</th><th class="r">Prix achat</th><th class="r">Prix vente</th><th class="r">Prix promo</th><th></th></tr></thead><tbody>
${list.map(a => `<tr><td>${e(a.libellefa)}</td><td>${e(a.refarticles)}</td><td>${e(a.libarticles)}</td><td>${e(a.unitevaleur)}</td><td class="r">${money(a.prixachat)}</td><td class="r">${money(a.prixvente)}</td><td class="r">${money(a.prixpromo)}</td>
<td class="r" style="white-space:nowrap"><a class="btn sm" href="/gestion?p=articles&id=${a.idt_articles}">Modifier</a> <form method="post" style="display:inline" data-confirm="delete">${ctx.csrfField()}<button class="btn red sm" name="del" value="${a.idt_articles}">×</button></form></td></tr>`).join('')}
</tbody></table></div></div>`;
};
