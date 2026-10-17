'use strict';
const C = require('../core'); const { e, num } = C;
module.exports = async ctx => {
  ctx.title = 'Approvisionnement du dépôt principal';
  if (ctx.req.method === 'POST' && ctx.post('annuler')) {
    if (!ctx.isSuper()) { ctx.flash('Seul le Super Admin peut annuler un approvisionnement.', 'err'); ctx.redirect('?p=appro_depot'); }
    const n = ctx.post('annuler');
    const r = await C.tx(async () => {
      const l = await C.rows('SELECT * FROM t_appro WHERE numappro = ? AND structures = ?', [n, C.SIEGE]);
      if (!l.length) return { err: 'Approvisionnement introuvable.' };
      for (const a of l) {
        const s = await C.stockRow(C.SIEGE, a.refarticles);
        if (!s || Number(s.quantitestock) < Number(a.qteappro)) return { err: `Annulation impossible : le stock du siège en « ${a.libarticles} » (${C.qty(s?.quantitestock || 0)}) est inférieur à la quantité approvisionnée (${C.qty(a.qteappro)}).` };
      }
      for (const a of l) await C.stockMove(C.SIEGE, a.refarticles, -Number(a.qteappro));
      await C.q('DELETE FROM t_appro WHERE numappro = ? AND structures = ?', [n, C.SIEGE]);
      return { msg: `Approvisionnement ${n} annulé : quantités retirées du stock du siège.` };
    });
    ctx.flash(r.err || r.msg, r.err ? 'err' : 'ok'); ctx.redirect('?p=appro_depot');
  }
  if (ctx.req.method === 'POST') {
    let lines = []; try { lines = JSON.parse(ctx.post('lignes', '[]')); } catch {}
    const four = ctx.post('fournisseur') || 'FOURNISSEUR DIVERS';
    if (!lines.length) { ctx.flash('Ajoutez au moins un article.', 'err'); ctx.redirect('?p=appro_depot'); }
    const n = await C.tx(async () => {
      const n = await C.newNumero('appro', C.SIEGE);
      for (const l of lines) {
        const qte = num(l.qte); if (qte <= 0) continue;
        const pa = Math.round(num(l.pa)), pv = Math.round(num(l.pv));
        await C.q(`INSERT INTO t_appro (refarticles, libarticles, qteappro, dateappro, utilisateur, unitevaleur, fournisseur, annees, mois, numappro, structures, codearticles, num_lot, datefabrication, dateexpiation, prixachat, totalachat)
          VALUES (?,?,?,CURRENT_DATE,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [l.ref, l.lib, qte, ctx.uname(), l.unite, four, String(new Date().getFullYear()), C.moisFr(), n, C.SIEGE, C.SIEGE + l.ref, ctx.post('lot'), ctx.post('dfab') || null, ctx.post('dexp') || null, pa, Math.round(qte * pa)]);
        await C.stockMove(C.SIEGE, l.ref, qte);
        await C.q('UPDATE t_stock SET prixachat = ?, prixvente = ? WHERE structures = ? AND refarticles = ?', [pa, pv, C.SIEGE, l.ref]);
      }
      return n;
    });
    ctx.flash(`Approvisionnement ${n} enregistré : stock du dépôt principal mis à jour.`);
    ctx.redirect('?p=appro_depot&print=' + encodeURIComponent(n));
  }
  const fours = (await C.rows('SELECT fournisseur FROM t_fournisseur ORDER BY fournisseur')).map(r => r.fournisseur);
  const pr = ctx.get('print');
  const recents = await C.rows("SELECT numappro, MIN(dateappro) d, MIN(fournisseur) f, COUNT(*) n, SUM(totalachat) t FROM t_appro WHERE structures = ? AND fournisseur <> 'KFN SIEGE' GROUP BY numappro ORDER BY MIN(idt_appro) DESC LIMIT 20", [C.SIEGE]);
  return `<h1 class="page-title">Approvisionnement des produits pour dépôt principal</h1>
${pr ? `<div class="flash info">Bon d'approvisionnement : <a href="/gestion/print?t=appro&n=${encodeURIComponent(pr)}" target="_blank">imprimer ${e(pr)}</a></div>` : ''}
<form method="post" class="card" id="fa">${ctx.csrfField()}<input type="hidden" name="lignes" id="lignes">
  <div class="grid g4"><div class="f"><label>Date appro</label><input value="${C.dfr(C.today())}" readonly></div>
  <div class="f"><label>Agence</label><input value="${e(C.SIEGE)}" readonly class="big"></div>
  <div class="f"><label>Fournisseur</label><select name="fournisseur">${C.selOptions(fours, null, false)}</select></div><div class="f"><label>N° lot</label><input name="lot"></div>
  <div class="f"><label>Date fabrication</label><input type="date" name="dfab"></div><div class="f"><label>Date expiration</label><input type="date" name="dexp"></div></div>
  <div class="actions"><button type="button" class="btn maroon" id="pick">Afficher articles</button></div>
  <div class="grid g4"><div class="f"><label>Code article</label><input id="code" readonly></div><div class="f"><label>Référence</label><input id="ref" readonly></div>
  <div class="f"><label>Article</label><input id="lib" readonly></div><div class="f"><label>Unité de valeur</label><input id="unite" readonly></div>
  <div class="f"><label>Prix achat actuel</label><input id="pa" class="num" inputmode="numeric"></div><div class="f"><label>Prix vente actuel</label><input id="pv" class="num" inputmode="numeric"></div>
  <div class="f"><label>Quantités</label><input id="qte" class="big" inputmode="decimal" value="0"></div><div class="f" style="display:flex;align-items:flex-end"><button type="button" class="btn block" id="add">Ajouter +</button></div></div>
  <div class="grid-tools"><button type="button" class="btn sm red" id="rm">− Retirer la ligne</button></div>
  <div class="tbl-wrap"><table class="tbl" id="grid"><thead></thead><tbody></tbody><tfoot><tr><td colspan="5">Total</td><td class="r" id="tot">0</td></tr></tfoot></table></div>
  <div class="actions"><button class="btn" style="background:#0000E6">Enregistrer</button></div></form>
<div class="card"><h2>Derniers approvisionnements du dépôt principal</h2><div class="tbl-wrap"><table class="tbl grey"><thead><tr><th>N° appro</th><th>Date</th><th>Fournisseur</th><th class="r">Lignes</th><th class="r">Montant</th><th></th></tr></thead><tbody>
${recents.map(a => `<tr><td>${e(a.numappro)}</td><td>${C.dfr(a.d)}</td><td>${e(a.f)}</td><td class="r">${a.n}</td><td class="r">${C.money(a.t)}</td><td class="r" style="white-space:nowrap"><a class="btn sm ghost" target="_blank" href="/gestion/print?t=appro&n=${encodeURIComponent(a.numappro)}">Bon</a>${ctx.isSuper() ? ` <form method="post" style="display:inline" data-confirm="delete">${ctx.csrfField()}<button class="btn sm red" name="annuler" value="${e(a.numappro)}">Annuler</button></form>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Aucun approvisionnement.</td></tr>'}</tbody></table></div></div>
<script>
(function(){
  var cur=null, g=new KFN.Lines(document.getElementById('grid'),{input:document.getElementById('lignes'),key:'ref',
    cols:[{k:'lib',label:'Articles'},{k:'qte',label:'Quantités appro',cls:'r',fmt:KFN.fmt},{k:'unite',label:'Unité valeur'},{k:'pa',label:'Prix achat',cls:'r',fmt:KFN.fmt},{k:'pv',label:'Prix vente',cls:'r',fmt:KFN.fmt},{k:'total',label:'Total',cls:'r',fmt:KFN.fmt}],
    onChange:function(r){document.getElementById('tot').textContent=KFN.fmt(r.reduce(function(s,x){return s+x.total;},0));}});
  function v(id){return document.getElementById(id);}
  v('pick').onclick=function(){KFN.pick({title:'Articles du dépôt principal',url:'/gestion/api?a=stock&siege=1',cols:[{k:'code',label:'Code articles'},{k:'lib',label:'Libellé articles'},{k:'qte',label:'Quantité stock',cls:'r',fmt:KFN.fmt},{k:'pv',label:'Prix vente',cls:'r',fmt:KFN.fmt}],
    onPick:function(r){cur=r;v('code').value=r.code;v('ref').value=r.ref;v('lib').value=r.lib;v('unite').value=r.unite;v('pa').value=r.pa;v('pv').value=r.pv;v('qte').value='';v('qte').focus();}});};
  v('add').onclick=function(){if(!cur){KFN.toast('Choisissez d’abord un article avec « Afficher articles ».','err');return;}var q=KFN.num(v('qte').value);if(q<=0){KFN.toast('Saisissez une quantité supérieure à 0.','err');return;}
    var pa=KFN.num(v('pa').value);g.add({ref:cur.ref,lib:cur.lib,unite:cur.unite,qte:q,pa:pa,pv:KFN.num(v('pv').value),total:q*pa});cur=null;['code','ref','lib','unite','pa','pv'].forEach(function(k){v(k).value='';});v('qte').value='0';};
  v('rm').onclick=g.removeSelected;
  v('fa').addEventListener('submit',function(e){if(!g.rows.length){e.preventDefault();KFN.toast('Ajoutez au moins un article.','err');}});
})();
</script>`;
};
