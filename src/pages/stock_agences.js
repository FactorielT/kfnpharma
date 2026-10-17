'use strict';
const C = require('../core'); const { e, num } = C;
module.exports = async ctx => {
  ctx.title = 'Enregistrement du stock';
  if (ctx.req.method === 'POST') {
    const ag = ctx.agenceOk(ctx.post('agence'));
    if (ctx.post('action') === 'generer') {
      const r = await C.q(`INSERT INTO t_stock (refarticles, libarticles, quantitestock, quantitealerte, unitevaleur, structures, codearticles, prixachat, prixvente, familearticle, activer)
        SELECT s.refarticles, s.libarticles, 0, s.quantitealerte, s.unitevaleur, ?, ? || s.refarticles, s.prixvente, s.prixvente, s.familearticle, 1
        FROM t_stock s WHERE s.structures = ? AND NOT EXISTS (SELECT 1 FROM t_stock x WHERE x.structures = ? AND x.refarticles = s.refarticles)`, [ag, ag, C.SIEGE, ag]);
      ctx.flash(`${r.rowCount} article(s) ajouté(s) au stock de ${ag}.`);
    } else {
      const a = await C.row('SELECT * FROM t_articles WHERE refarticles = ?', [ctx.post('ref')]);
      if (!a) ctx.flash('Choisissez un article.', 'err');
      else if (await C.stockRow(ag, a.refarticles)) ctx.flash(`Cet article existe déjà dans le stock de ${ag}.`, 'err');
      else { await C.stockMove(ag, a.refarticles, num(ctx.post('qte')), { libarticles: a.libarticles, unitevaleur: a.unitevaleur, familearticle: a.libellefa, prixachat: Math.round(num(ctx.post('pa'))), prixvente: Math.round(num(ctx.post('pv'))), quantitealerte: num(ctx.post('alerte')) }); ctx.flash(`Article ajouté au stock de ${ag}.`); }
    }
    ctx.redirect('?p=stock_agences');
  }
  const arts = await C.rows('SELECT refarticles, libarticles, libellefa, unitevaleur, prixachat, prixvente FROM t_articles ORDER BY libarticles');
  return `<h1 class="page-title">Gestion des stocks par agence</h1><div class="grid g2">
<form method="post" class="card">${ctx.csrfField()}<input type="hidden" name="action" value="generer"><h2>1. Génération du stock par agence</h2>
  <p class="hint">Crée dans l'agence choisie tous les articles du siège qui n'y sont pas encore (quantité 0).</p>
  <div class="f"><label>Agence</label><select name="agence" required>${ctx.agOptions(null, true, true)}</select></div>
  <div class="actions"><button class="btn dark">Générer le stock de l'agence choisie</button></div></form>
<form method="post" class="card">${ctx.csrfField()}<input type="hidden" name="action" value="ajout"><h2>2. Ajout d'un nouvel article dans le stock d'une agence</h2>
  <div class="grid g2"><div class="f span2"><label>Agence</label><select name="agence" required>${ctx.agOptions(null, true)}</select></div>
  <div class="f span2"><label>Article</label><select name="ref" id="art" required><option value="">— Choisir —</option>
  ${arts.map(a => `<option value="${e(a.refarticles)}" data-fam="${e(a.libellefa)}" data-u="${e(a.unitevaleur)}" data-pa="${a.prixachat}" data-pv="${a.prixvente}">${e(a.libarticles)}</option>`).join('')}</select></div>
  <div class="f"><label>Famille article</label><input id="fam" readonly></div><div class="f"><label>Référence</label><input id="refv" readonly></div>
  <div class="f"><label>Unité de valeur</label><input id="uv" readonly></div><div class="f"><label>Quantité initiale</label><input name="qte" class="num" inputmode="decimal" value="0"></div>
  <div class="f"><label>Prix achat</label><input name="pa" id="pa" class="num" inputmode="numeric"></div><div class="f"><label>Prix vente</label><input name="pv" id="pv" class="num" inputmode="numeric"></div>
  <div class="f"><label>Quantité d'alerte</label><input name="alerte" class="num" value="5" inputmode="decimal"></div></div>
  <div class="actions"><button class="btn">Ajouter à l'agence</button></div></form></div>
<script>document.getElementById('art').addEventListener('change',function(){var o=this.selectedOptions[0];['fam','uv','pa','pv'].forEach(function(k){document.getElementById(k).value=o.dataset[k==='uv'?'u':k]||'';});document.getElementById('refv').value=this.value;});</script>`;
};
