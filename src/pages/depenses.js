'use strict';
const C = require('../core'); const { e, money, num } = C;
module.exports = async ctx => {
  ctx.title = 'Dépenses journalières';
  const ag = ctx.agenceOk(ctx.get('agence') || ctx.post('agence'));
  if (ctx.req.method === 'POST') {
    const m = Math.round(num(ctx.post('montant')));
    if (!ctx.post('depense') || m <= 0) ctx.flash('Choisissez la dépense et saisissez le montant.', 'err');
    else if (Number(await C.val('SELECT COUNT(*) FROM t_fermercaisse WHERE structures = ? AND datefermer = CURRENT_DATE AND caissefermee = 1', [ag]))) ctx.flash(`La caisse du jour est déjà fermée pour ${ag}.`, 'err');
    else { await C.q('INSERT INTO t_sortieargent (depense, motif, montantdepense, datedepenses, utilisateur, structures) VALUES (?,?,?,CURRENT_DATE,?,?)', [ctx.post('depense'), ctx.post('motif').slice(0, 50), m, ctx.uname(), ag]); ctx.flash(`Dépense de ${money(m)} FCFA enregistrée.`); }
    ctx.redirect('?p=depenses&agence=' + encodeURIComponent(ag));
  }
  const types = [...new Set((await C.rows("SELECT depense FROM t_depenses WHERE structures IN ('', ?) OR structures IS NULL ORDER BY depense", [ag])).map(r => r.depense))];
  const jour = await C.rows('SELECT * FROM t_sortieargent WHERE structures = ? AND datedepenses = CURRENT_DATE ORDER BY idt_sortieargent DESC', [ag]);
  return `<h1 class="page-title">Sortie d'argent</h1>
<form method="post" class="card" style="max-width:640px;margin-inline:auto">${ctx.csrfField()}<p style="text-align:center"><b>${C.dfr(C.today())}</b></p>
  <div class="f"><label>Agence</label><select name="agence">${ctx.agOptions(ag)}</select></div>
  <div class="row" style="margin-top:.7rem"><div class="f"><label>Dépenses</label><select name="depense" id="dep" required>${C.selOptions(types)}</select></div><button type="button" class="btn" id="adddep">Ajouter dépense</button></div>
  <div class="f" style="margin-top:.7rem"><label>Montant</label><input name="montant" class="big" inputmode="numeric" required value="0"></div>
  <div class="f" style="margin-top:.7rem"><label>Motif</label><textarea name="motif" rows="3" maxlength="50"></textarea></div>
  <div class="actions"><a class="btn ghost" href="/gestion">Retour</a><button class="btn">Valider</button></div></form>
<div class="card"><h2>Dépenses du jour — total ${money(jour.reduce((s, d) => s + d.montantdepense, 0))} FCFA</h2><div class="tbl-wrap"><table class="tbl grey"><thead><tr><th>Dépense</th><th>Motif</th><th class="r">Montant</th><th>Utilisateur</th></tr></thead><tbody>
${jour.map(d => `<tr><td>${e(d.depense)}</td><td>${e(d.motif)}</td><td class="r">${money(d.montantdepense)}</td><td>${e(d.utilisateur)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Aucune dépense aujourd\'hui.</td></tr>'}</tbody></table></div></div>
<script>document.getElementById('adddep').onclick=function(){var d=prompt('Nouveau type de dépense :');if(!d)return;KFN.post('/gestion/api?a=add_depense',{depense:d,agence:document.querySelector('[name=agence]').value}).then(function(r){if(r.error){KFN.toast(r.error,'err');return;}document.getElementById('dep').add(new Option(r.depense,r.depense,true,true));KFN.toast('Dépense ajoutée.');});};</script>`;
};
