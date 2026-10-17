'use strict';
const C = require('../core'); const V = require('../ventes'); const { e } = C;
module.exports = async ctx => {
  ctx.title = 'Édition de factures';
  if (ctx.req.method === 'POST') {
    const ag = ctx.agenceOk(ctx.post('agence')), client = ctx.post('client');
    let lines = []; try { lines = JSON.parse(ctx.post('lignes', '[]')); } catch {}
    if (!client || !lines.length) { ctx.flash('Choisissez le client et ajoutez au moins un article.', 'err'); ctx.redirect('?p=facture'); }
    if (ag === C.SIEGE) { ctx.flash("Le siège ne vend pas aux agences : elles s'approvisionnent par les pré-commandes.", 'err'); ctx.redirect('?p=facture&agence=' + encodeURIComponent(ag)); }
    const t = ctx.post('type') === 'proforma' ? 'proforma' : 'facture';
    const n = await C.tx(() => t === 'proforma' ? V.saveProforma(ctx, ag, client, lines) : V.saveFacture(ctx, ag, client, lines));
    ctx.flash((t === 'facture' ? 'Facture ' : 'Pro-forma ') + n + ' enregistrée.' + (t === 'facture' ?  ' Le client peut passer à la caisse.' : ''));
    ctx.redirect(`?p=facture&agence=${encodeURIComponent(ag)}&done=${encodeURIComponent(n)}&t=${t}`);
  }
  const ag = ctx.agenceOk(ctx.get('agence')), done = ctx.get('done');
  if (ag === C.SIEGE) return `<h1 class="page-title">Édition de facture</h1>
<div class="card"><div class="flash info" style="margin:0 0 1rem">Le <b>siège ne vend pas aux agences</b>. Les agences s'approvisionnent par les <b>pré-commandes</b> :
une pré-commande validée par le siège puis acceptée par l'agence devient une facture d'approvisionnement, c'est-à-dire un <b>impayé de l'agence</b>,
réglé dans <b>Compte des agences (clientes du siège)</b>, avec le détail des versements, le solde et le reste.</div>
<div class="actions" style="justify-content:flex-start"><a class="btn orange" href="/gestion?p=compte_agences">Ouvrir le compte des agences</a><a class="btn" href="/gestion?p=appro_agences">Approvisionnement des agences</a>
<form method="get" action="/gestion" class="row" style="margin-left:auto"><input type="hidden" name="p" value="facture"><select name="agence" data-autosubmit>${ctx.agOptions(ag)}</select></form></div></div>`;
  return `<h1 class="page-title">Édition de facture</h1>
${done ? `<div class="flash info"><a class="btn sm green" href="/gestion/print?t=${e(ctx.get('t'))}&n=${encodeURIComponent(done)}" target="_blank">Imprimer ${e(done)}</a></div>` : ''}
<form method="post" class="card" id="ff">${ctx.csrfField()}<input type="hidden" name="lignes" id="lignes">
  <div class="grid g4"><div class="f"><label>Date vente</label><input value="${C.dfr(C.today())}" readonly style="color:#B42318;font-weight:800"></div>
  <div class="f"><label>Agence</label><select name="agence" id="agence">${ctx.agOptions(ag)}</select></div>
  <div class="f"><label>Type de document</label><select name="type" id="type"><option value="facture">Facture</option><option value="proforma">Pro-forma (devis)</option></select></div><div class="f"></div>
  <div class="f span2"><label id="lcl">Client</label><select name="client" id="client" required></select></div>
  <div class="f" style="display:flex;align-items:flex-end"><button type="button" class="btn block" id="newc" style="font-style:italic">Nouveau client</button></div>
  <div class="f" style="display:flex;align-items:flex-end"><button type="button" class="btn maroon block" id="pick">Afficher articles</button></div>
  <div class="f"><label>Référence</label><input id="ref" readonly></div><div class="f"><label>Article</label><input id="lib" readonly></div>
  <div class="f"><label>Unité de valeur</label><input id="unite" readonly></div><div class="f"><label>Stock disponible</label><input id="stk" readonly></div>
  <div class="f"><label>Prix vente</label><input id="pv" class="num" inputmode="numeric" value="0"></div><div class="f"><label>Quantité(s)</label><input id="qte" class="big" inputmode="decimal" value="0"></div>
  <div class="f"><label>Montant total</label><input id="mt" readonly class="num" value="0"></div><div class="f"><label>Remise</label><input id="rem" class="num" inputmode="numeric" value="0"></div>
  <div class="f"><label>Montant après remise</label><input id="net" readonly class="num" value="0"></div>
  <div class="f" style="display:flex;align-items:flex-end"><button type="button" class="btn block" id="add">Ajouter +</button></div></div>
  <div class="grid-tools"><button type="button" class="btn sm red" id="rm">− Retirer la ligne</button></div>
  <div class="tbl-wrap"><table class="tbl" id="grid"><thead></thead><tbody></tbody></table></div>
  <div class="row" style="justify-content:center;margin-top:1rem"><div class="f" style="max-width:300px"><label>Total facture</label><input id="tot" class="total-box" readonly value="0"></div></div>
  <div class="actions"><button class="btn" style="min-width:160px">Valider</button></div>
  <p class="hint" style="text-align:center">Pour rééditer ou corriger une facture ou une pro-forma, allez dans « Modification de factures ».</p></form>
<dialog id="dlg" style="border:0;border-radius:14px;padding:0;width:min(460px,94vw)"><form method="dialog" class="card" style="margin:0" id="fc"><h2>Nouveau client</h2>
  <div class="f"><label>Nom prénoms</label><input id="cnom" required></div><div class="f"><label>Contact</label><input id="ccontact" inputmode="tel"></div><div class="f"><label>Localité</label><input id="cquartier"></div>
  <div class="actions"><button value="cancel" class="btn ghost" formnovalidate>Annuler</button><button type="button" id="csave" class="btn green">Enregistrer</button></div></form></dialog>
<script>
(function(){
  var SIEGE=${JSON.stringify(C.SIEGE)};function v(id){return document.getElementById(id);}var cur=null;
  var g=new KFN.Lines(v('grid'),{input:v('lignes'),cols:[{k:'ref',label:'Référence'},{k:'lib',label:'Articles'},{k:'qte',label:'Quantités',cls:'r',fmt:KFN.fmt},{k:'unite',label:'Unité valeur'},{k:'pv',label:'Prix vente',cls:'r',fmt:KFN.fmt},{k:'total',label:'Total',cls:'r',fmt:KFN.fmt},{k:'remise',label:'Remise',cls:'r',fmt:KFN.fmt},{k:'net',label:'Montant après remise',cls:'r',fmt:KFN.fmt}],
    onChange:function(r){v('tot').value=KFN.fmt(r.reduce(function(s,x){return s+x.net;},0));}});
  function loadClients(sel){var s=v('agence').value===SIEGE;v('newc').style.visibility=s?'hidden':'';v('lcl').textContent=s?'Agence cliente':'Client';
    KFN.get('/gestion/api?a=clients&agence='+encodeURIComponent(v('agence').value)).then(function(l){v('client').innerHTML='<option value="">— '+(s?'Choisir l’agence cliente':'Choisir le client')+' —</option>'+l.map(function(c){return '<option'+(c.nom===sel?' selected':'')+'>'+KFN.esc(c.nom)+'</option>';}).join('');});}
  function calc(){var m=KFN.num(v('pv').value)*KFN.num(v('qte').value);v('mt').value=KFN.fmt(m);v('net').value=KFN.fmt(m-KFN.num(v('rem').value));}
  ['pv','qte','rem'].forEach(function(k){v(k).addEventListener('input',calc);});
  v('agence').onchange=function(){location='/gestion?p=facture&agence='+encodeURIComponent(v('agence').value);};
  v('pick').onclick=function(){KFN.pick({title:'Articles en stock — '+v('agence').value,url:'/gestion/api?a=stock&agence='+encodeURIComponent(v('agence').value),cols:[{k:'ref',label:'Référence'},{k:'lib',label:'Libellé'},{k:'qte',label:'Stock',cls:'r',fmt:KFN.fmt},{k:'pv',label:'Prix vente',cls:'r',fmt:KFN.fmt}],
    onPick:function(r){cur=r;v('ref').value=r.ref;v('lib').value=r.lib;v('unite').value=r.unite;v('stk').value=KFN.fmt(r.qte);v('pv').value=r.pv;v('qte').value='';v('rem').value=0;calc();v('qte').focus();}});};
  v('add').onclick=function(){if(!cur){KFN.toast('Choisissez un article avec « Afficher articles ».','err');return;}var q=KFN.num(v('qte').value),pv=KFN.num(v('pv').value),r=KFN.num(v('rem').value);
    if(q<=0){KFN.toast('Saisissez la quantité.','err');return;}if(v('type').value==='facture'&&q>+cur.qte)KFN.toast('Attention : quantité supérieure au stock disponible ('+KFN.fmt(cur.qte)+').','info');
    g.add({ref:cur.ref,lib:cur.lib,qte:q,unite:cur.unite,pv:pv,total:q*pv,remise:r,net:q*pv-r});cur=null;['ref','lib','unite','stk'].forEach(function(k){v(k).value='';});v('pv').value=0;v('qte').value='0';v('rem').value=0;calc();};
  v('rm').onclick=g.removeSelected;v('newc').onclick=function(){v('dlg').showModal();v('cnom').focus();};
  v('csave').onclick=function(){KFN.post('/gestion/api?a=add_client',{nom:v('cnom').value,contact:v('ccontact').value,quartier:v('cquartier').value,agence:v('agence').value}).then(function(d){if(d.error){KFN.toast(d.error,'err');return;}v('dlg').close();v('fc').reset();loadClients(d.nom);KFN.toast('Client '+d.nom+' créé.');});};
  v('ff').addEventListener('submit',function(e){if(!g.rows.length){e.preventDefault();KFN.toast('Ajoutez au moins un article.','err');}});
  loadClients();
})();
</script>`;
};
