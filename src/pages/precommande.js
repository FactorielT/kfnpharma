'use strict';
const C = require('../core'); const WA = require('../whatsapp'); const { e, money, num } = C;
module.exports = async ctx => {
  ctx.title = "Pré-commande d'approvisionnement";
  if (ctx.req.method === 'POST' && ['supprimer_pre', 'modifier_pre'].includes(ctx.post('action'))) {
    ctx.requireEdit('?p=precommande');
    const code = ctx.post('code');
    const lignes = await C.rows("SELECT * FROM t_precommandeagence WHERE idcmde = ? AND statut = 'EN_ATTENTE'", [code]);
    if (!lignes.length || !ctx.agences.includes(lignes[0].structures)) { ctx.flash('Pré-commande introuvable ou déjà validée par le siège : elle ne peut plus être modifiée.', 'err'); ctx.redirect('?p=precommande'); }
    if (ctx.post('action') === 'supprimer_pre') {
      await C.q("DELETE FROM t_precommandeagence WHERE idcmde = ? AND statut = 'EN_ATTENTE'", [code]);
      ctx.flash(`Pré-commande ${code} supprimée.`);
    } else {
      const qv = ctx.B.q || {}; let n = 0, sup = 0;
      await C.tx(async () => {
        for (const l of lignes) {
          const v = qv['i' + l.idprecommandeagence]; if (v === undefined) continue;
          const q = num(v);
          if (q <= 0) { await C.q('DELETE FROM t_precommandeagence WHERE idprecommandeagence = ?', [l.idprecommandeagence]); sup++; }
          else if (q !== Number(l.qte)) { await C.q('UPDATE t_precommandeagence SET qte = ?, totalvente = ? WHERE idprecommandeagence = ?', [q, Math.round(q * l.pv), l.idprecommandeagence]); n++; }
        }
      });
      ctx.flash(`Pré-commande ${code} modifiée : ${n} quantité(s) changée(s)${sup ? `, ${sup} ligne(s) retirée(s)` : ''}.`);
    }
    ctx.redirect('?p=precommande');
  }
  if (ctx.req.method === 'POST') {
    const ag = ctx.agenceOk(ctx.post('agence'));
    let lines = []; try { lines = JSON.parse(ctx.post('lignes', '[]')); } catch {}
    if (ag === C.SIEGE) { ctx.flash("Le siège ne passe pas de pré-commande : utilisez l'approvisionnement du dépôt principal.", 'err'); ctx.redirect('?p=precommande'); }
    if (!lines.length) { ctx.flash('Ajoutez au moins un article.', 'err'); ctx.redirect('?p=precommande'); }
    const n = await C.tx(async () => {
      const n = await C.newNumero('precommande', ag);
      for (const l of lines) {
        const qte = num(l.qte); if (qte <= 0) continue;
        const s = await C.stockRow(C.SIEGE, l.ref); if (!s) continue;
        await C.q(`INSERT INTO t_precommandeagence (idcmde, refarticles, libarticles, qte, pv, totalvente, dateenreg, mois, annee, utilisateur, unitevaleur, structures, codearticles, accepter, idcmde_ref, statut)
          VALUES (?,?,?,?,?,?,CURRENT_DATE,?,?,?,?,?,?,0,?,'EN_ATTENTE')`, [n, s.refarticles, s.libarticles, qte, s.prixvente, Math.round(qte * s.prixvente), C.moisFr(), String(new Date().getFullYear()), ctx.uname(), s.unitevaleur, ag, ag + s.refarticles, n + ' ' + ag + s.refarticles]);
      }
      return n;
    });
    const b = await WA.surPrecommande(n, ctx.uname()).catch(err => { console.error(err); return null; });
    ctx.flash(`Pré-commande ${n} envoyée au siège. Elle apparaîtra dans « Approvisionnements » une fois validée.` + WA.resume(b));
    ctx.redirect('?p=precommande&fiche=' + encodeURIComponent(n));
  }
  const ags = ctx.agences, inn = ags.map(() => '?').join(',');
  const editCode = ctx.get('edit') && ctx.canEdit() ? ctx.get('edit') : '';
  const editL = editCode ? await C.rows(`SELECT * FROM t_precommandeagence WHERE idcmde = ? AND statut = 'EN_ATTENTE' AND structures IN (${inn}) ORDER BY idprecommandeagence`, [editCode, ...ags]) : [];
  const enCours = await C.rows(`SELECT idcmde, structures, MIN(dateenreg) d, COUNT(*) n, SUM(totalvente) t, statut FROM t_precommandeagence
    WHERE structures IN (${inn}) AND statut IN ('EN_ATTENTE','VALIDE_SIEGE') GROUP BY idcmde, structures, statut ORDER BY d DESC LIMIT 30`, ags);
  const fiche = ctx.get('fiche');
  return `${fiche ? `<div class="flash info" style="display:flex;gap:1rem;align-items:center;flex-wrap:wrap">Fiche de la pré-commande <b>${e(fiche)}</b> prête. <a class="btn green" target="_blank" href="/gestion/print?t=fichepre&n=${encodeURIComponent(fiche)}">Imprimer la fiche</a></div>` : ''}<h1 class="page-title" style="background:#111;color:#FFE600;font-style:italic">Simulation de commande ou pré-approvisionnement chez KFN Siège</h1>
<form method="post" class="card" id="fp">${ctx.csrfField()}<input type="hidden" name="lignes" id="lignes">
  <div class="grid g4"><div class="f"><label>Date appro</label><input value="${C.dfr(C.today())}" readonly></div>
  <div class="f span2"><label>Agence</label><select name="agence" id="agence" required>${ctx.agOptions(ctx.isSiege() ? null : ctx.ustruct(), ctx.isSiege(), true)}</select></div>
  <div class="f" style="display:flex;align-items:flex-end"><button type="button" class="btn maroon block" id="pick">Afficher articles</button></div>
  <div class="f"><label>Référence</label><input id="ref" readonly></div><div class="f"><label>Article</label><input id="lib" readonly></div>
  <div class="f"><label>Unité de valeur</label><input id="unite" readonly></div><div class="f"><label>Prix d'achat à KFN Siège</label><input id="pa" readonly class="num"></div>
  <div class="f"><label>Quantités souhaitées</label><input id="qte" class="big" inputmode="decimal" value="0"></div>
  <div class="f" style="display:flex;align-items:flex-end"><button type="button" class="btn block" id="add">Ajouter +</button></div></div>
  <div class="grid-tools"><button type="button" class="btn sm red" id="rm">− Retirer la ligne</button></div>
  <div class="tbl-wrap"><table class="tbl" id="grid"><thead></thead><tbody></tbody></table></div>
  <div class="row" style="justify-content:center;margin-top:1rem"><div class="f" style="max-width:340px"><label>Valeur de la commande (prix d'achat chez KFN Siège)</label><input id="tot" class="dark-box" readonly value="0"></div></div>
  <div class="actions"><button class="btn" style="background:#0000E6">Enregistrer</button></div></form>
${editL.length ? `<form method="post" class="card" data-confirm="modify" style="border:2px solid var(--orange)">${ctx.csrfField()}<input type="hidden" name="action" value="modifier_pre"><input type="hidden" name="code" value="${e(editCode)}">
  <h2>Modifier la pré-commande ${e(editCode)} — ${e(editL[0].structures)}</h2><p class="hint">Changez les quantités ; mettez 0 pour retirer un article. Possible tant que le siège n'a pas validé.</p>
  <div class="tbl-wrap"><table class="tbl grey"><thead><tr><th>Référence</th><th>Article</th><th class="r">Prix</th><th class="r">Quantité</th></tr></thead><tbody>
  ${editL.map(l => `<tr><td>${e(l.refarticles)}</td><td>${e(l.libarticles)}</td><td class="r">${money(l.pv)}</td><td class="edit"><input name="q[i${l.idprecommandeagence}]" value="${l.qte}" inputmode="decimal"></td></tr>`).join('')}</tbody></table></div>
  <div class="actions"><a class="btn ghost" href="/gestion?p=precommande">Annuler</a><button class="btn green">Modifier</button></div></form>` : ''}
<div class="card"><h2>Mes pré-commandes en cours</h2><div class="tbl-wrap"><table class="tbl grey"><thead><tr><th>Code</th><th>Agence</th><th>Date</th><th class="r">Lignes</th><th class="r">Valeur</th><th>État</th>${ctx.canEdit() ? '<th></th>' : ''}</tr></thead><tbody>
${enCours.map(p => `<tr><td>${e(p.idcmde)}</td><td>${e(p.structures)}</td><td>${C.dfr(p.d)}</td><td class="r">${p.n}</td><td class="r">${money(p.t)}</td><td>${p.statut === 'EN_ATTENTE' ? '<span class="badge o">En attente au siège</span>' : '<span class="badge">Validée — à réceptionner</span>'}</td>
  ${ctx.canEdit() ? `<td class="r" style="white-space:nowrap">${p.statut === 'EN_ATTENTE' ? `<a class="btn sm" href="/gestion?p=precommande&edit=${encodeURIComponent(p.idcmde)}">Modifier</a>
  <form method="post" style="display:inline" data-confirm="delete">${ctx.csrfField()}<input type="hidden" name="action" value="supprimer_pre"><button class="btn sm red" name="code" value="${e(p.idcmde)}">Supprimer</button></form>` : ''}</td>` : ''}</tr>`).join('') || '<tr><td colspan="7" class="empty">Aucune pré-commande en cours.</td></tr>'}
</tbody></table></div></div>
<script>
(function(){
  function v(id){return document.getElementById(id);}
  var cur=null,g=new KFN.Lines(v('grid'),{input:v('lignes'),key:'ref',merge:function(a,b){a.qte+=b.qte;a.total=a.qte*a.pa;},
    cols:[{k:'ref',label:'Réf siège'},{k:'refag',label:'Réf agence'},{k:'lib',label:'Articles'},{k:'qte',label:'Quantités souhaitées',cls:'r',fmt:KFN.fmt},{k:'unite',label:'Unité valeur'},{k:'pa',label:'Prix achat',cls:'r',fmt:KFN.fmt},{k:'total',label:'Total',cls:'r',fmt:KFN.fmt}],
    onChange:function(r){v('tot').value=KFN.fmt(r.reduce(function(s,x){return s+x.total;},0));}});
  v('pick').onclick=function(){if(!v('agence').value){KFN.toast('Choisissez d’abord l’agence.','err');return;}
    KFN.pick({title:'Articles disponibles chez KFN Siège',url:'/gestion/api?a=stock&siege=1',cols:[{k:'ref',label:'Référence'},{k:'lib',label:'Libellé articles'},{k:'unite',label:'Unité'},{k:'pv',label:'Prix achat siège',cls:'r',fmt:KFN.fmt}],
      onPick:function(r){cur=r;v('ref').value=r.ref;v('lib').value=r.lib;v('unite').value=r.unite;v('pa').value=KFN.fmt(r.pv);v('qte').value='';v('qte').focus();}});};
  v('add').onclick=function(){if(!cur){KFN.toast('Choisissez d’abord un article.','err');return;}var q=KFN.num(v('qte').value);if(q<=0){KFN.toast('Saisissez la quantité souhaitée.','err');return;}
    g.add({ref:cur.ref,refag:v('agence').value+cur.ref,lib:cur.lib,unite:cur.unite,qte:q,pa:+cur.pv,total:q*cur.pv});cur=null;['ref','lib','unite','pa'].forEach(function(k){v(k).value='';});v('qte').value='0';};
  v('rm').onclick=g.removeSelected;
  v('fp').addEventListener('submit',function(e){if(!g.rows.length){e.preventDefault();KFN.toast('Ajoutez au moins un article.','err');}});
})();
</script>`;
};
