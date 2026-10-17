'use strict';
const C = require('../core'); const WA = require('../whatsapp'); const { num } = C;
module.exports = async ctx => {
  ctx.title = 'Approvisionnement des agences';
  if (ctx.req.method === 'POST') {
    const code = ctx.post('code'); let lines = []; try { lines = JSON.parse(ctx.post('lignes', '[]')); } catch {}
    if (!code || !lines.length) { ctx.flash('Chargez une pré-commande avant d’enregistrer.', 'err'); ctx.redirect('?p=appro_agences'); }
    const r = await C.tx(async () => {
      const ag = await C.val('SELECT structures FROM t_precommandeagence WHERE idcmde = ? LIMIT 1', [code]);
      let servies = 0; const manque = [];
      for (const l of lines) {
        const p = await C.row("SELECT * FROM t_precommandeagence WHERE idprecommandeagence = ? AND idcmde = ? AND statut = 'EN_ATTENTE' FOR UPDATE", [Number(l.id), code]);
        if (!p) continue;
        const dispo = Number(await C.val('SELECT COALESCE(quantitestock,0) FROM t_stock WHERE structures = ? AND refarticles = ? FOR UPDATE', [C.SIEGE, p.refarticles]) || 0);
        const qte = Math.max(0, Math.min(num(l.possible), Number(p.qte), Math.max(0, dispo)));
        if (num(l.possible) > qte) manque.push(p.libarticles);
        await C.q("UPDATE t_precommandeagence SET qtevalidee = ?, statut = 'VALIDE_SIEGE', datevalidation = CURRENT_DATE, validepar = ? WHERE idprecommandeagence = ?", [qte, ctx.uname(), p.idprecommandeagence]);
        if (qte > 0) {
          await C.stockMove(C.SIEGE, p.refarticles, -qte);
          await C.q('INSERT INTO t_bonsorti_dp (structures, refarticles, articles, unitevaleur, quantitesortie, datesortie, heure, utilisateur, numprecommande) VALUES (?,?,?,?,?,CURRENT_DATE,LOCALTIME,?,?)',
            [ag, p.refarticles, String(p.libarticles).slice(0, 50), p.unitevaleur, qte, ctx.uname(), code]);
          servies++;
        }
      }
      return { ag, servies, manque };
    });
    const b = await WA.surValidation(code, ctx.uname()).catch(err => { console.error(err); return null; });
    ctx.flash(`Pré-commande ${code} validée : ${r.servies} ligne(s) servie(s) et retirée(s) du stock du siège. L'agence ${r.ag} doit maintenant confirmer la réception.` + (r.manque.length ? ' Quantité réduite au stock disponible pour : ' + r.manque.join(', ') + '.' : '') + WA.resume(b));
    ctx.redirect('?p=appro_agences');
  }
  return `<h1 class="page-title">Approvisionnement des produits par agences</h1>
<form method="post" class="card" id="fv">${ctx.csrfField()}<input type="hidden" name="lignes" id="lignes"><input type="hidden" name="code" id="code">
  <div class="row"><div class="f" style="max-width:160px"><label>Date appro</label><input value="${C.dfr(C.today())}" readonly style="color:#B42318;font-weight:800"></div>
  <div class="f"><label>Agence</label><select id="agence">${ctx.agOptions(null, true, true)}</select></div><button type="button" class="btn maroon" id="aff">Afficher</button></div>
  <p class="hint" id="info">Choisissez une agence puis « Afficher » pour voir ses pré-commandes en attente.</p>
  <div class="grid-tools"><button type="button" class="btn sm red" id="rm">− Retirer la ligne</button></div>
  <div class="tbl-wrap"><table class="tbl" id="grid"><thead></thead><tbody></tbody><tfoot><tr><td colspan="6">Total accordé</td><td class="r" id="tot">0</td></tr></tfoot></table></div>
  <p class="hint">Seule la colonne <b>Quantité possible à prendre</b> est modifiable. Elle est limitée à la quantité demandée et au stock du siège.</p>
  <div class="actions"><button class="btn" style="background:#0000E6">Enregistrer</button></div></form>
<script>
(function(){
  function v(id){return document.getElementById(id);}
  var g=new KFN.Lines(v('grid'),{input:v('lignes'),empty:'Aucune pré-commande chargée.',recalc:function(r){if(r.possible>r.dispo)r.possible=Math.max(0,+r.dispo);r.total=r.possible*r.pa;},
    cols:[{k:'ref',label:'Référence'},{k:'lib',label:'Articles'},{k:'demande',label:'Quantités demandées',cls:'r',fmt:KFN.fmt},{k:'dispo',label:'Stock siège',cls:'r',fmt:function(x){return KFN.fmt(x);}},
      {k:'possible',label:'Quantité possible à prendre',edit:true,max:'demande'},{k:'pa',label:'Prix achat',cls:'r',fmt:KFN.fmt},{k:'total',label:'Total',cls:'r',fmt:KFN.fmt},{k:'code',label:'Code'},{k:'idref',label:'IDCmde_Ref'}],
    onChange:function(r){v('tot').textContent=KFN.fmt(r.reduce(function(s,x){return s+x.possible*x.pa;},0));}});
  v('aff').onclick=function(){var ag=v('agence').value;if(!ag){KFN.toast('Choisissez une agence.','err');return;}
    KFN.pick({title:'Pré-commandes en attente — '+ag,url:'/gestion/api?a=precmd_attente&agence='+encodeURIComponent(ag),empty:'Aucune pré-commande en attente pour cette agence.',
      cols:[{k:'code',label:'Code'},{k:'date',label:'Date'},{k:'lignes',label:'Lignes',cls:'r'},{k:'qte',label:'Quantité',cls:'r',fmt:KFN.fmt},{k:'total',label:'Valeur',cls:'r',fmt:KFN.fmt}],
      onPick:function(p){KFN.get('/gestion/api?a=precmd_lignes&code='+encodeURIComponent(p.code)).then(function(l){v('code').value=p.code;g.set(l);v('info').innerHTML='Pré-commande <b>'+KFN.esc(p.code)+'</b> du '+KFN.esc(p.date)+' — vérifiez les quantités puis enregistrez.';});}});};
  v('rm').onclick=g.removeSelected;
  v('fv').addEventListener('submit',function(e){if(!g.rows.length){e.preventDefault();KFN.toast('Chargez une pré-commande.','err');}});
})();
</script>`;
};
