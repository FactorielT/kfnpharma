'use strict';
const C = require('../core'); const { e, qty, num } = C;
module.exports = async ctx => {
  ctx.title = 'Retrait de stock (péremption)';
  const ag = ctx.agenceOk(ctx.post('agence') || ctx.get('agence'));
  if (ctx.req.method === 'POST' && ctx.post('annuler')) {
    ctx.requireEdit('?p=peremption&agence=' + encodeURIComponent(ag));
    await C.tx(async () => {
      const p = await C.row('SELECT * FROM t_peremption WHERE idt_peremption = ? AND structures = ?', [Number(ctx.post('annuler')), ag]);
      if (!p) return;
      const s = await C.row('SELECT refarticles FROM t_stock WHERE codearticles = ? AND structures = ?', [p.codearticles, ag]);
      if (s) await C.stockMove(ag, s.refarticles, Number(p.quantitesorti));
      await C.q('DELETE FROM t_peremption WHERE idt_peremption = ?', [p.idt_peremption]);
    });
    ctx.flash('Retrait annulé : la quantité est remise en stock.');
    ctx.redirect('?p=peremption&agence=' + encodeURIComponent(ag));
  }
  if (ctx.req.method === 'POST') {
    let lines = []; try { lines = JSON.parse(ctx.post('lignes', '[]')); } catch {}
    if (!lines.length) { ctx.flash('Ajoutez au moins un article à retirer.', 'err'); ctx.redirect('?p=peremption'); }
    await C.tx(async () => {
      for (const l of lines) {
        const s = await C.stockRow(ag, l.ref), q = num(l.qte); if (!s || q <= 0) continue;
        await C.q(`INSERT INTO t_peremption (libarticles, quantitestock, quantitesorti, unitevaleur, structures, codearticles, quantiterestant, motif, operateur, dateoperation, heureoperation)
          VALUES (?,?,?,?,?,?,?,?,?,CURRENT_DATE,LOCALTIME)`, [s.libarticles, s.quantitestock, q, s.unitevaleur, ag, s.codearticles, s.quantitestock - q, String(l.motif || '').slice(0, 200), ctx.uname()]);
        await C.stockMove(ag, l.ref, -q);
      }
    });
    ctx.flash(`Retrait de stock enregistré pour ${ag}.`);
    ctx.redirect('?p=peremption&agence=' + encodeURIComponent(ag));
  }
  const hist = await C.rows('SELECT * FROM t_peremption WHERE structures = ? ORDER BY idt_peremption DESC LIMIT 30', [ag]);
  return `<h1 class="page-title" style="background:#0D4F9C">Sortie de stock (péremption)</h1>
<form method="post" class="card" id="fp">${ctx.csrfField()}<input type="hidden" name="lignes" id="lignes">
  <div class="grid g4"><div class="f"><label>Date</label><input value="${C.dfr(C.today())}" readonly></div><div class="f"><label>Agence</label><select name="agence" id="agence">${ctx.agOptions(ag)}</select></div>
  <div class="f"><label>Référence</label><input id="ref" readonly></div><div class="f" style="display:flex;align-items:flex-end"><button type="button" class="btn maroon block" id="pick">Afficher articles</button></div>
  <div class="f"><label>Article</label><input id="lib" readonly></div><div class="f"><label>Unité de valeur</label><input id="unite" readonly></div>
  <div class="f"><label>Quantité(s) en stock actuel</label><input id="stk" readonly class="big"></div><div class="f"><label>Quantité(s) qui doit sortir</label><input id="qte" class="dark-box" inputmode="decimal" value="0"></div>
  <div class="f"><label>Quantité(s) reste en stock</label><input id="reste" readonly class="big"></div>
  <div class="f span2"><label>Motif de retrait</label><textarea id="motif" rows="2" placeholder="Exemple : périmé depuis le 15/05/2026"></textarea></div>
  <div class="f" style="display:flex;align-items:flex-end"><button type="button" class="btn block" id="add">Ajouter +</button></div></div>
  <div class="grid-tools"><button type="button" class="btn sm red" id="rm">− Retirer la ligne</button></div>
  <div class="tbl-wrap"><table class="tbl" id="grid"><thead></thead><tbody></tbody></table></div>
  <div class="actions"><button class="btn" style="background:#0000E6">Enregistrer</button></div></form>
<div class="card"><h2>Derniers retraits</h2><div class="tbl-wrap"><table class="tbl grey"><thead><tr><th>Date</th><th>Article</th><th class="r">Qté retirée</th><th class="r">Reste</th><th>Motif</th><th>Opérateur</th>${ctx.canEdit() ? '<th></th>' : ''}</tr></thead><tbody>
${hist.map(h => `<tr><td>${C.dfr(h.dateoperation)}</td><td>${e(h.libarticles)}</td><td class="r">${qty(h.quantitesorti)}</td><td class="r">${qty(h.quantiterestant)}</td><td>${e(h.motif)}</td><td>${e(h.operateur)}</td>${ctx.canEdit() ? `<td class="r"><form method="post" data-confirm="delete">${ctx.csrfField()}<input type="hidden" name="agence" value="${e(ag)}"><button class="btn sm red" name="annuler" value="${h.idt_peremption}">Annuler</button></form></td>` : ''}</tr>`).join('') || '<tr><td colspan="7" class="empty">Aucun retrait enregistré.</td></tr>'}</tbody></table></div></div>
<script>
(function(){function v(id){return document.getElementById(id);}
  var cur=null,g=new KFN.Lines(v('grid'),{input:v('lignes'),key:'ref',cols:[{k:'ref',label:'Référence'},{k:'lib',label:'Articles'},{k:'stk',label:'Quantités en stock',cls:'r',fmt:KFN.fmt},{k:'qte',label:'Quantité retirée',cls:'r',fmt:KFN.fmt},{k:'reste',label:'Reste en stock',cls:'r',fmt:KFN.fmt},{k:'unite',label:'Unité valeur'},{k:'motif',label:'Motif'}]});
  v('pick').onclick=function(){KFN.pick({title:'Stock — '+v('agence').value,url:'/gestion/api?a=stock&agence='+encodeURIComponent(v('agence').value),cols:[{k:'ref',label:'Référence'},{k:'lib',label:'Libellé'},{k:'qte',label:'Stock',cls:'r',fmt:KFN.fmt},{k:'unite',label:'Unité'}],
    onPick:function(r){cur=r;v('ref').value=r.ref;v('lib').value=r.lib;v('unite').value=r.unite;v('stk').value=KFN.fmt(r.qte);v('qte').value='';v('reste').value=KFN.fmt(r.qte);v('qte').focus();}});};
  v('qte').oninput=function(){if(cur)v('reste').value=KFN.fmt(cur.qte-KFN.num(v('qte').value));};
  v('add').onclick=function(){if(!cur){KFN.toast('Choisissez un article.','err');return;}var q=KFN.num(v('qte').value);if(q<=0){KFN.toast('Saisissez la quantité à sortir.','err');return;}
    if(!v('motif').value.trim()){KFN.toast('Saisissez le motif du retrait.','err');return;}
    g.add({ref:cur.ref,lib:cur.lib,stk:+cur.qte,qte:q,reste:cur.qte-q,unite:cur.unite,motif:v('motif').value.trim()});cur=null;['ref','lib','unite','stk','reste','motif'].forEach(function(k){v(k).value='';});v('qte').value='0';};
  v('agence').onchange=function(){g.set([]);};v('rm').onclick=g.removeSelected;})();
</script>`;
};
