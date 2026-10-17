'use strict';
/* Paiement à la caisse — partagé par caisse_jour (factures du jour) et caisse_impayes (crédits) */
const C = require('../core'); const { e, money, num } = C;
module.exports = async (ctx, mode, page) => {
  const ag = ctx.agenceOk(ctx.get('agence') || ctx.post('agence'));
  const back = `?p=${page}&agence=${encodeURIComponent(ag)}`, siege = ag === C.SIEGE;
  if (siege) {
    if (ctx.req.method === 'POST') { ctx.flash('Les impayés des agences se règlent dans Compte des agences (clientes du siège).', 'err'); ctx.redirect('?p=compte_agences'); }
    return `<h1 class="page-title">Paiement à la caisse du siège</h1>
<div class="card"><div class="flash info" style="margin:0 0 1rem">Le <b>siège ne vend pas aux agences</b>. Les agences s'approvisionnent par les <b>pré-commandes</b> :
une pré-commande validée par le siège puis acceptée par l'agence devient une facture d'approvisionnement, c'est-à-dire un <b>impayé de l'agence</b>,
réglé dans <b>Compte des agences (clientes du siège)</b>, avec le détail des versements, le solde et le reste.</div>
<div class="actions" style="justify-content:flex-start"><a class="btn orange" href="/gestion?p=compte_agences">Ouvrir le compte des agences</a><a class="btn" href="/gestion?p=appro_agences">Approvisionnement des agences</a>
<form method="get" action="/gestion" class="row" style="margin-left:auto"><input type="hidden" name="p" value="${page}"><select name="agence" data-autosubmit>${ctx.agOptions(ag)}</select></form></div></div>`;
  }
  if (ctx.req.method === 'POST' && ctx.post('annuler')) {
    ctx.requireEdit(back);
    const pid = ctx.post('annuler'), sl = pid[0] === 'S', id = Number(pid.slice(1));
    const r = await C.tx(async () => {
      const p = sl ? await C.row('SELECT * FROM t_paiement_sl WHERE idpaiementsl = ? AND structures = ?', [id, ag]) : await C.row('SELECT * FROM t_paiement WHERE idpaiement = ? AND structures = ?', [id, ag]);
      if (!p) return { err: 'Paiement introuvable.' };
      if (Number(await C.val('SELECT COUNT(*) FROM t_fermercaisse WHERE structures = ? AND datefermer = ? AND caissefermee = 1', [ag, p.datepaiement]))) return { err: `La caisse du ${C.dfr(p.datepaiement)} est fermée : rouvrez-la d'abord (Fermeture de caisse).` };
      await C.q(sl ? 'DELETE FROM t_paiement_sl WHERE idpaiementsl = ?' : 'DELETE FROM t_paiement WHERE idpaiement = ?', [id]);
      await C.q('UPDATE t_commande SET verse = GREATEST(0, verse - ?), reste = reste + LEAST(verse, ?) WHERE numcmde = ? AND structures = ?', [p.verse, p.verse, p.numcmde, ag]);
      return { msg: `Paiement de ${money(p.verse)} FCFA sur ${p.numcmde} annulé : le montant est de nouveau dû.` };
    });
    ctx.flash(r.err || r.msg, r.err ? 'err' : 'ok'); ctx.redirect(back);
  }
  if (ctx.req.method === 'POST') {
    const numc = ctx.post('num'), percu = Math.round(num(ctx.post('percu')));
    const r = await C.tx(async () => {
      const c = await C.row('SELECT * FROM t_commande WHERE numcmde = ? AND structures = ? FOR UPDATE', [numc, ag]);
      if (!c || c.reste <= 0) return { err: 'Facture introuvable ou déjà soldée.' };
      // Au siège, seules les agences paient
      if (siege && !Number(await C.val('SELECT COUNT(*) FROM t_structure WHERE nom_structure = ? AND nom_structure <> ?', [c.nomprenom, C.SIEGE]))) return { err: 'Au siège, seules les agences peuvent payer.' };
      if (percu <= 0) return { err: 'Saisissez le montant perçu.' };
      const paye = Math.min(percu, c.reste), rendu = Math.max(0, percu - c.reste), reste = c.reste - paye;
      let pid;
      if (mode === 'jour') pid = 'P' + await C.val(`INSERT INTO t_paiement (numcmde, client, montantcmde, paye, datepaiement, annee, agent, livre, reste, verse, rendu, cash, structures, modepaiement, heure)
          VALUES (?,?,?,?,CURRENT_DATE,?,?,1,?,?,?,?,?,?,LOCALTIME) RETURNING idpaiement`, [numc, c.nomprenom, c.mtapayer, c.verse + paye, String(new Date().getFullYear()), ctx.uname(), reste, paye, rendu, reste === 0 ? 1 : 0, ag, ctx.post('modep')]);
      else pid = 'S' + await C.val(`INSERT INTO t_paiement_sl (numcmde, client, montantcmde, paye, datepaiement, annee, agent, reste, rendu, verse, structures, modepaiement, heure)
          VALUES (?,?,?,?,CURRENT_DATE,?,?,?,?,?,?,?,LOCALTIME) RETURNING idpaiementsl`, [numc, c.nomprenom, c.mtapayer, c.verse + paye, String(new Date().getFullYear()), ctx.uname().slice(0, 30), reste, rendu, paye, ag, ctx.post('modep')]);
      await C.q('UPDATE t_commande SET verse = verse + ?, reste = ? WHERE idcommande = ?', [paye, reste, c.idcommande]);
      if (siege) await C.q('INSERT INTO t_compteagence (structures, montant_total, verse, dateversement, utilisateur, moyen, reference, solde) VALUES (?,?,?,CURRENT_DATE,?,?,?,?)', [c.nomprenom, c.mtapayer, paye, ctx.uname(), ctx.post('modep'), numc, reste]);
      return { msg: `Paiement de ${money(paye)} FCFA enregistré pour ${numc}.` + (rendu ? ` Monnaie à rendre : ${money(rendu)}.` : '') + (reste ? ` Reste dû : ${money(reste)}.` : ' Facture soldée.'), pid };
    });
    if (r.err) { ctx.flash(r.err, 'err'); ctx.redirect(back); }
    ctx.flash(r.msg); ctx.redirect(back + '&recu=' + r.pid);
  }
  const facts = mode === 'jour'
    ? await C.rows('SELECT numcmde, nomprenom, mtapayer, reste, datecmde FROM t_commande WHERE structures = ? AND datecmde = CURRENT_DATE AND reste > 0 ORDER BY idcommande DESC', [ag])
    : await C.rows('SELECT numcmde, nomprenom, mtapayer, reste, datecmde FROM t_commande WHERE structures = ? AND reste > 0 ORDER BY nomprenom, datecmde', [ag]);
  const clients = [...new Set(facts.map(f => f.nomprenom))];
  const tbl = mode === 'jour' ? 't_paiement' : 't_paiement_sl', idc = mode === 'jour' ? 'idpaiement' : 'idpaiementsl', pre = mode === 'jour' ? 'P' : 'S';
  const payes = await C.rows(`SELECT ${idc} AS id, numcmde, client, verse, modepaiement, agent, heure FROM ${tbl} WHERE structures = ? AND datepaiement = CURRENT_DATE ORDER BY ${idc} DESC`, [ag]);
  const recu = ctx.get('recu'), lc = siege ? 'Agence cliente' : 'Client';
  return `<h1 class="page-title" style="background:${mode === 'jour' ? 'var(--green)' : '#1B3A6B'}">Paiement à la caisse${siege ? ' du siège' : ''}</h1>
${recu ? `<div class="flash info"><a class="btn sm green" href="/gestion/print?t=recu&n=${e(recu)}" target="_blank">Imprimer le reçu</a></div>` : ''}
${siege ? '<div class="flash info">À la caisse du siège, seules les <b>agences</b> paient : leurs factures d\'approvisionnement et d\'achats au siège.</div>' : ''}
<form method="post" class="card" id="fpay">${ctx.csrfField()}<input type="hidden" name="num" id="num">
  <div class="row" style="justify-content:space-between;margin-bottom:1rem"><button type="button" class="btn orange" id="reed">Rééditer reçu</button>
    <div class="f" style="max-width:260px"><select name="agence" onchange="location='/gestion?p=${page}&agence='+encodeURIComponent(this.value)">${ctx.agOptions(ag)}</select></div>
    <a class="btn green" href="/gestion${back}">Actualiser</a></div>
  <h2 style="text-align:center;background:${mode === 'jour' ? 'var(--orange)' : '#1B3A6B'};color:#fff;padding:.4rem;border-radius:8px">${mode === 'jour' ? 'Paiement des factures éditées ce jour' : 'Paiements des impayés de factures'}</h2>
  <div class="grid g3">
    ${mode === 'credit' ? `<div class="f"><label>${lc}</label><select id="cli">${C.selOptions(clients, null, true, '— ' + lc + ' —')}</select></div>` : ''}
    <div class="f ${mode === 'jour' ? 'span2' : ''}"><label>N° facture${mode === 'jour' ? ' du jour' : ''}</label><select id="fact"><option value="">— ${facts.length ? 'Choisir' : 'Aucune facture à encaisser'} —</option>
      ${facts.map(f => `<option value="${e(f.numcmde)}" data-client="${e(f.nomprenom)}" data-reste="${f.reste}" data-mt="${f.mtapayer}">${e(f.numcmde)} · ${e(f.nomprenom)}${mode === 'credit' ? ' · ' + C.dfr(f.datecmde) : ''} · reste ${money(f.reste)}</option>`).join('')}</select></div>
    <div class="f"><label>${lc}</label><input id="client" readonly></div></div>
  ${mode === 'jour' ? `<div class="actions" style="justify-content:flex-end"><a class="btn red" href="/gestion?p=caisse_impayes&agence=${encodeURIComponent(ag)}">Paiement des impayés de factures par ${siege ? 'agence' : 'client'}</a></div>` : ''}
  <div class="tbl-wrap" style="margin-top:1rem"><table class="tbl navy" id="lg"><thead><tr><th>N° commande</th><th>Référence</th><th>Libellé articles</th><th class="r">Quantités</th><th>Unité</th><th class="r">Prix vente</th><th class="r">Total vente</th></tr></thead><tbody><tr><td colspan="7" class="empty">Choisissez une facture.</td></tr></tbody></table></div>
  <div class="grid g4" style="margin-top:1rem;max-width:900px;margin-inline:auto">
    <div class="f"><label>Total facture</label><input id="mt" class="total-box" readonly></div><div class="f"><label>Reste à payer</label><input id="du" class="big" readonly></div>
    <div class="f"><label>Saisissez le montant perçu</label><input name="percu" id="percu" class="big" inputmode="numeric" value="0"></div><div class="f"><label id="lres">Reste / monnaie</label><input id="res" class="big" readonly></div>
    <div class="f span2"><label>Mode de paiement</label><select name="modep">${C.selOptions(['Espèce', 'Mobile Money', 'Chèque', 'Virement', 'Carte bancaire'], null, false)}</select></div></div>
  <div class="actions"><a class="btn ghost" href="/gestion">Retour</a><button class="btn" style="min-width:150px">Valider</button></div></form>
<div class="card"><h2>${mode === 'jour' ? 'Paiements encaissés aujourd\'hui' : 'Paiements d\'impayés encaissés aujourd\'hui'} — ${money(payes.reduce((s, x) => s + x.verse, 0))} FCFA</h2>
<div class="tbl-wrap"><table class="tbl grey"><thead><tr><th>Heure</th><th>N° facture</th><th>${lc}</th><th class="r">Versé</th><th>Mode</th><th>Caissier(ère)</th><th></th></tr></thead><tbody>
${payes.map(x => `<tr><td>${e(String(x.heure || '').slice(0, 5))}</td><td>${e(x.numcmde)}</td><td>${e(x.client)}</td><td class="r">${money(x.verse)}</td><td>${e(x.modepaiement)}</td><td>${e(x.agent)}</td>
  <td class="r" style="white-space:nowrap"><a class="btn sm ghost" target="_blank" href="/gestion/print?t=recu&n=${pre}${x.id}">Reçu</a>${ctx.canEdit() ? ` <form method="post" style="display:inline" data-confirm="delete">${ctx.csrfField()}<input type="hidden" name="agence" value="${e(ag)}"><button class="btn sm red" name="annuler" value="${pre}${x.id}">Annuler</button></form>` : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">Aucun paiement aujourd\'hui.</td></tr>'}</tbody></table></div></div>
<script>
(function(){function v(id){return document.getElementById(id);}var due=0,cli=v('cli');
  if(cli)cli.onchange=function(){[].forEach.call(v('fact').options,function(o,i){if(i)o.hidden=cli.value&&o.dataset.client!==cli.value;});v('fact').value='';};
  v('fact').onchange=function(){var o=this.selectedOptions[0];v('num').value=this.value;v('client').value=o.dataset.client||'';due=+o.dataset.reste||0;v('mt').value=KFN.fmt(o.dataset.mt||0);v('du').value=KFN.fmt(due);v('percu').value=due;calc();
    var tb=v('lg').tBodies[0];if(!this.value){tb.innerHTML='';return;}tb.innerHTML='<tr><td colspan="7" class="empty">Chargement…</td></tr>';
    KFN.get('/gestion/api?a=facture_lignes&num='+encodeURIComponent(this.value)).then(function(d){tb.innerHTML=(d.lignes||[]).map(function(l){return '<tr><td>'+KFN.esc(d.cmd.numcmde)+'</td><td>'+KFN.esc(l.ref)+'</td><td>'+KFN.esc(l.lib)+'</td><td class="r">'+KFN.fmt(l.qte)+'</td><td>'+KFN.esc(l.unite)+'</td><td class="r">'+KFN.fmt(l.pv)+'</td><td class="r">'+KFN.fmt(l.net)+'</td></tr>';}).join('');});
    v('percu').focus();v('percu').select();};
  function calc(){var p=KFN.num(v('percu').value),r=p-due;v('lres').textContent=r>=0?'Monnaie à rendre':'Reste dû (crédit)';v('res').value=KFN.fmt(Math.abs(r));}
  v('percu').addEventListener('input',calc);
  v('reed').onclick=function(){KFN.pick({title:'Rééditer un reçu',url:'/gestion/api?a=paiements&agence=${encodeURIComponent(ag)}',cols:[{k:'date',label:'Date'},{k:'num',label:'N° facture'},{k:'client',label:'Client'},{k:'verse',label:'Versé',cls:'r',fmt:KFN.fmt},{k:'mode',label:'Mode'}],onPick:function(r){window.open('/gestion/print?t=recu&n='+r.id);}});};
  v('fpay').addEventListener('submit',function(e){if(!v('num').value){e.preventDefault();KFN.toast('Choisissez une facture.','err');}});})();
</script>`;
};
