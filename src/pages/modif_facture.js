'use strict';
const C = require('../core'); const V = require('../ventes'); const { e, money } = C;
module.exports = async ctx => {
  ctx.title = 'Modification de factures';
  const ag = ctx.agenceOk(ctx.get('agence') || ctx.post('agence'));
  const back = '?p=modif_facture&agence=' + encodeURIComponent(ag);
  if (ctx.req.method === 'POST') {
    ctx.requireEdit(back);
    const num = ctx.post('num'), type = ctx.post('type'), act = ctx.post('action'), client = ctx.post('client');
    let lines = []; try { lines = JSON.parse(ctx.post('lignes', '[]')); } catch {}
    const r = await C.tx(async () => {
      if (type === 'Facture') {
        const c = await C.row('SELECT * FROM t_commande WHERE numcmde = ? AND structures = ? FOR UPDATE', [num, ag]);
        if (!c) return { err: 'Facture introuvable.' };
        if (Number(c.livre) === 2) return { err: "Facture d'approvisionnement d'agence : elle ne se modifie pas ici (le stock a été transféré par l'appro)." };
        if (act === 'supprimer' && c.verse > 0) return { err: 'Cette facture a déjà reçu un paiement : suppression impossible.' };
        if (act !== 'supprimer' && !lines.length) return { err: 'La facture doit garder au moins une ligne (ou utilisez Supprimer).' };
        await V.annulerLignes(ctx, c);
        if (act === 'supprimer') { await C.q('DELETE FROM t_commande WHERE idcommande = ?', [c.idcommande]); return { msg: `Facture ${num} supprimée, stock rétabli.` }; }
        await V.saveFacture(ctx, ag, c.nomprenom, lines, { num, old: c });
        const n = Number(await C.val('SELECT mtapayer FROM t_commande WHERE numcmde = ?', [num]));
        return { msg: `Facture ${num} modifiée.` + (n < c.verse ? ` Attention : le nouveau montant (${money(n)}) est inférieur au montant déjà versé (${money(c.verse)}).` : ''), num, t: 'facture' };
      }
      await C.q('DELETE FROM t_proforma WHERE idcmde = ? AND structures = ?', [num, ag]);
      if (act === 'supprimer') return { msg: `Pro-forma ${num} supprimée.` };
      if (act === 'convertir') {
        if (ag === C.SIEGE && !await V.estAgenceCliente(client)) return { err: 'Au siège, le client doit être une agence.' };
        const f = await V.saveFacture(ctx, ag, client, lines); return { msg: `Pro-forma ${num} transformée en facture ${f}.`, num: f, t: 'facture' };
      }
      await V.saveProforma(ctx, ag, client, lines, num); return { msg: `Pro-forma ${num} modifiée.`, num, t: 'proforma' };
    }).catch(err => ({ err: err.message }));
    if (r.err) { ctx.flash(r.err, 'err'); ctx.redirect(back); }
    ctx.flash(r.msg);
    ctx.redirect(back + (r.num ? `&done=${encodeURIComponent(r.num)}&t=${r.t}` : ''));
  }
  const done = ctx.get('done');
  return `<h1 class="page-title">Modification de facture / pro-forma</h1>
${ctx.canEdit() ? '' : '<div class="flash info">Consultation seulement : la modification et la suppression sont réservées au Super Admin, à l’Administrateur et au Responsable d’agence.</div>'}
${done ? `<div class="flash info"><a class="btn sm green" href="/gestion/print?t=${e(ctx.get('t'))}&n=${encodeURIComponent(done)}" target="_blank">Imprimer ${e(done)}</a></div>` : ''}
<form method="post" class="card" id="fm">${ctx.csrfField()}<input type="hidden" name="lignes" id="lignes"><input type="hidden" name="num" id="num"><input type="hidden" name="type" id="type"><input type="hidden" name="action" id="action" value="modifier">
  <div class="grid g4"><div class="f"><label>Agence</label><select name="agence" id="agence">${ctx.agOptions(ag)}</select></div>
  <div class="f"><label id="lcl">Client</label><select name="client" id="client"></select></div><div class="f span2"><label>N° facture</label><select id="fact"><option value="">— Choisir d'abord le client —</option></select></div></div>
  <p class="hint" id="info"></p>
  <div class="grid g4" style="border-top:6px solid var(--green);padding-top:1rem">
    <div class="f" style="display:flex;align-items:flex-end"><button type="button" class="btn maroon block" id="pick">Afficher articles</button></div>
    <div class="f"><label>Article</label><input id="lib" readonly></div><div class="f"><label>Prix vente</label><input id="pv" class="num" inputmode="numeric" value="0"></div>
    <div class="f"><label>Quantité(s)</label><input id="qte" class="big" inputmode="decimal" value="0"></div><div class="f"><label>Remise</label><input id="rem" class="num" inputmode="numeric" value="0"></div>
    <div class="f"><label>Montant après remise</label><input id="net" readonly class="num" value="0"></div><div class="f" style="display:flex;align-items:flex-end"><button type="button" class="btn block" id="add">Ajouter +</button></div></div>
  <div class="grid-tools"><button type="button" class="btn sm" id="rm">Retirer la ligne sélectionnée</button></div>
  <div class="tbl-wrap"><table class="tbl" id="grid"><thead></thead><tbody></tbody></table></div>
  <div class="row" style="justify-content:center;margin-top:1rem"><div class="f" style="max-width:300px"><label>Total facture</label><input id="tot" class="total-box" readonly value="0"></div></div>
  <div class="actions"><button type="button" class="btn" id="print">Imprimer</button>${ctx.canEdit() ? `<button class="btn green" data-act="modifier" data-confirm="modify">Modifier</button>
    <button class="btn orange" data-act="convertir" id="conv" hidden>Transformer en facture</button><button class="btn red" data-act="supprimer" data-confirm="delete">Supprimer</button>` : ''}</div></form>
<script>
(function(){
  var SIEGE=${JSON.stringify(C.SIEGE)};function v(id){return document.getElementById(id);}var cur=null,facts=[];
  var g=new KFN.Lines(v('grid'),{input:v('lignes'),empty:'Choisissez une facture.',cols:[{k:'ref',label:'Référence'},{k:'lib',label:'Articles'},{k:'qte',label:'Quantités',cls:'r',fmt:KFN.fmt},{k:'unite',label:'Unité valeur'},{k:'pv',label:'Prix vente',cls:'r',fmt:KFN.fmt},{k:'total',label:'Total',cls:'r',fmt:KFN.fmt},{k:'remise',label:'Remise',cls:'r',fmt:KFN.fmt},{k:'net',label:'Mt à payer',cls:'r',fmt:KFN.fmt}],
    onChange:function(r){v('tot').value=KFN.fmt(r.reduce(function(s,x){return s+KFN.num(x.net);},0));}});
  function ag(){return encodeURIComponent(v('agence').value);}
  function loadClients(){v('lcl').textContent=v('agence').value===SIEGE?'Agence cliente':'Client';KFN.get('/gestion/api?a=clients&agence='+ag()).then(function(l){v('client').innerHTML='<option value="">— Client —</option>'+l.map(function(c){return '<option>'+KFN.esc(c.nom)+'</option>';}).join('');});}
  v('agence').onchange=function(){location='/gestion?p=modif_facture&agence='+encodeURIComponent(v('agence').value);};
  v('client').onchange=function(){KFN.get('/gestion/api?a=factures_client&agence='+ag()+'&client='+encodeURIComponent(v('client').value)).then(function(l){facts=l;
    v('fact').innerHTML='<option value="">— '+(l.length?'Choisir la facture':'Aucune facture')+' —</option>'+l.map(function(f,i){return '<option value="'+i+'">'+KFN.esc(f.num)+' · '+f.type+' · '+f.date+' · '+KFN.fmt(f.montant)+(f.livre==2?' · facture d’appro':'')+'</option>';}).join('');g.set([]);v('info').textContent='';});};
  v('fact').onchange=function(){var f=facts[this.value];if(!f)return;v('num').value=f.num;v('type').value=f.type;if(v('conv'))v('conv').hidden=f.type!=='Pro-forma';
    KFN.get((f.type==='Facture'?'/gestion/api?a=facture_lignes&num=':'/gestion/api?a=proforma_lignes&num=')+encodeURIComponent(f.num)).then(function(d){var l=d.lignes||d;l.forEach(function(x){x.qte=+x.qte;x.pv=+x.pv;x.total=+x.total;x.remise=+x.remise;x.net=+x.net;});g.set(l);
      v('info').innerHTML=f.type+' <b>'+KFN.esc(f.num)+'</b> du '+f.date+(f.type==='Facture'?' — déjà versé : <b>'+KFN.fmt(f.verse)+'</b>':'')+(f.livre==2?' — <b>facture d’approvisionnement : non modifiable ici</b>':'');});};
  function calc(){v('net').value=KFN.fmt(KFN.num(v('pv').value)*KFN.num(v('qte').value)-KFN.num(v('rem').value));}
  ['pv','qte','rem'].forEach(function(k){v(k).addEventListener('input',calc);});
  v('pick').onclick=function(){KFN.pick({title:'Articles en stock',url:'/gestion/api?a=stock&agence='+ag(),cols:[{k:'ref',label:'Référence'},{k:'lib',label:'Libellé'},{k:'qte',label:'Stock',cls:'r',fmt:KFN.fmt},{k:'pv',label:'Prix',cls:'r',fmt:KFN.fmt}],onPick:function(r){cur=r;v('lib').value=r.lib;v('pv').value=r.pv;v('qte').value='';calc();v('qte').focus();}});};
  v('add').onclick=function(){if(!v('num').value){KFN.toast('Choisissez d’abord une facture.','err');return;}if(!cur){KFN.toast('Choisissez un article.','err');return;}
    var q=KFN.num(v('qte').value),pv=KFN.num(v('pv').value),r=KFN.num(v('rem').value);if(q<=0){KFN.toast('Saisissez la quantité.','err');return;}
    g.add({ref:cur.ref,lib:cur.lib,qte:q,unite:cur.unite,pv:pv,total:q*pv,remise:r,net:q*pv-r});cur=null;v('lib').value='';v('qte').value='0';calc();};
  v('rm').onclick=g.removeSelected;
  v('print').onclick=function(){if(v('num').value)window.open('/gestion/print?t='+(v('type').value==='Facture'?'facture':'proforma')+'&n='+encodeURIComponent(v('num').value));};
  document.querySelectorAll('[data-act]').forEach(function(b){b.addEventListener('click',function(e){if(!v('num').value){e.preventDefault();KFN.toast('Choisissez une facture.','err');return;}v('action').value=b.dataset.act;});});
  loadClients();
})();
</script>`;
};
