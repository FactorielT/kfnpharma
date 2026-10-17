'use strict';
const C = require('../core'); const { e, money, num } = C;
module.exports = async ctx => {
  ctx.title = 'Fermeture de caisse du jour';
  const ag = ctx.agenceOk(ctx.get('agence') || ctx.post('agence')), date = ctx.get('date') || ctx.post('date') || C.today();
  const [cash, ech, vers, dep] = (await Promise.all([
    C.val('SELECT COALESCE(SUM(verse),0) FROM t_paiement WHERE structures = ? AND datepaiement = ?', [ag, date]),
    C.val('SELECT COALESCE(SUM(verse),0) FROM t_paiement_sl WHERE structures = ? AND datepaiement = ?', [ag, date]),
    C.val('SELECT COALESCE(SUM(montantverse),0) FROM t_versementsa WHERE structures = ? AND dateversement = ?', [ag, date]),
    C.val('SELECT COALESCE(SUM(montantdepense),0) FROM t_sortieargent WHERE structures = ? AND datedepenses = ?', [ag, date])])).map(Number);
  const cumul = cash + ech + vers, logiciel = cumul - dep;
  const fermee = await C.row('SELECT * FROM t_fermercaisse WHERE structures = ? AND datefermer = ? AND caissefermee = 1', [ag, date]);
  if (ctx.req.method === 'POST' && ctx.post('rouvrir')) {
    ctx.requireEdit(`?p=fermeture_caisse&agence=${encodeURIComponent(ag)}&date=${date}`);
    await C.q('DELETE FROM t_fermercaisse WHERE structures = ? AND datefermer = ?', [ag, date]);
    ctx.flash(`Caisse du ${C.dfr(date)} rouverte : vous pouvez corriger les paiements et dépenses, puis l'arrêter de nouveau.`);
    ctx.redirect(`?p=fermeture_caisse&agence=${encodeURIComponent(ag)}&date=${date}`);
  }
  if (ctx.req.method === 'POST') {
    if (fermee) ctx.flash(`La caisse du ${C.dfr(date)} est déjà fermée.`, 'err');
    else if (ctx.post('physique') === '') ctx.flash('Saisissez le montant réel compté dans la caisse.', 'err');
    else {
      const phys = Math.round(num(ctx.post('physique')));
      await C.q(`INSERT INTO t_fermercaisse (datefermer, caissepaiementcahs, caissepaiementecheance, caisseversement, cumulcaissejour, caissedepensejour, valeurlogicielcaissejour, valeurphysiquecaissejour, ecart, utilisateur, structures, pointagejour, caissefermee, structuresdatefermer)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,1,1,?)`, [date, cash, ech, vers, cumul, dep, logiciel, phys, phys - logiciel, ctx.uname(), ag, ag + date]);
      ctx.flash(`Caisse du ${C.dfr(date)} arrêtée. Écart : ${money(phys - logiciel)} FCFA.`, phys === logiciel ? 'ok' : 'info');
    }
    ctx.redirect(`?p=fermeture_caisse&agence=${encodeURIComponent(ag)}&date=${date}`);
  }
  return `<h1 class="page-title">Fermeture de caisse du jour</h1>
<div class="card" style="max-width:620px;margin-inline:auto"><form method="get" action="/gestion" class="row"><input type="hidden" name="p" value="fermeture_caisse">
  <div class="f"><label>Agence</label><select name="agence">${ctx.agOptions(ag)}</select></div><div class="f"><label>Date du jour</label><input type="date" name="date" value="${e(date)}"></div><button class="btn">Afficher</button></form>
<form method="post" style="margin-top:1rem">${ctx.csrfField()}<input type="hidden" name="agence" value="${e(ag)}"><input type="hidden" name="date" value="${e(date)}">
  <div class="grid g2"><div class="f"><label>Paiements des factures du jour</label><input readonly class="num" value="${money(cash)}"></div><div class="f"><label>Paiements des impayés (crédits)</label><input readonly class="num" value="${money(ech)}"></div>
  <div class="f"><label>Montant total des paiements du jour</label><input readonly class="num" value="${money(cumul)}"></div><div class="f"><label>Montant total des dépenses</label><input readonly class="total-box" value="${money(dep)}"></div>
  <div class="f span2"><label>Valeur de la caisse du jour</label><input readonly class="dark-box" value="${money(logiciel)}"></div>
  <div class="f span2"><label>Montant réel physique</label><input name="physique" id="phys" class="big" inputmode="numeric" ${fermee ? `readonly value="${money(fermee.valeurphysiquecaissejour)}"` : ''}></div>
  <div class="f span2"><label>Écart</label><input id="ecart" readonly class="big" value="${fermee ? money(fermee.ecart) : ''}"></div></div>
  ${fermee ? `<div class="flash ok" style="margin-top:1rem">Caisse fermée par ${e(fermee.utilisateur)}.</div>${ctx.canEdit() ? `<div class="actions"><button class="btn orange" name="rouvrir" value="1" data-confirm="Rouvrir la caisse du ${C.dfr(date)} ? Elle devra être arrêtée de nouveau." data-kind="modify">Rouvrir la caisse</button></div>` : ''}` : '<div class="actions"><a class="btn ghost" href="/gestion">Retour</a><button class="btn orange">Arrêter la caisse</button></div>'}</form></div>
<script>var p=document.getElementById('phys');if(p&&!p.readOnly)p.addEventListener('input',function(){document.getElementById('ecart').value=KFN.fmt(KFN.num(p.value)-${logiciel});});</script>`;
};
