'use strict';
const C = require('../core'); const { e, money, num } = C;
module.exports = async ctx => {
  ctx.title = 'Dépenses journalières';
  const ag = ctx.agenceOk(ctx.get('agence') || ctx.post('agence')), back = '?p=depenses&agence=' + encodeURIComponent(ag);
  const fermee = async d => Number(await C.val('SELECT COUNT(*) FROM t_fermercaisse WHERE structures = ? AND datefermer = ? AND caissefermee = 1', [ag, d]));
  if (ctx.req.method === 'POST') {
    const id = Number(ctx.post('id')) || 0;
    if (ctx.post('del') || id) {
      ctx.requireEdit(back);
      const d = await C.row('SELECT * FROM t_sortieargent WHERE idt_sortieargent = ? AND structures = ?', [Number(ctx.post('del') || id), ag]);
      if (!d) ctx.flash('Dépense introuvable.', 'err');
      else if (await fermee(d.datedepenses)) ctx.flash(`La caisse du ${C.dfr(d.datedepenses)} est fermée : rouvrez-la d'abord (Fermeture de caisse).`, 'err');
      else if (ctx.post('del')) { await C.q('DELETE FROM t_sortieargent WHERE idt_sortieargent = ?', [d.idt_sortieargent]); ctx.flash('Dépense supprimée.'); }
      else {
        const m = Math.round(num(ctx.post('montant')));
        if (!ctx.post('depense') || m <= 0) ctx.flash('Choisissez la dépense et saisissez le montant.', 'err');
        else { await C.q('UPDATE t_sortieargent SET depense = ?, motif = ?, montantdepense = ? WHERE idt_sortieargent = ?', [ctx.post('depense'), ctx.post('motif').slice(0, 50), m, d.idt_sortieargent]); ctx.flash('Dépense modifiée.'); }
      }
      ctx.redirect(back);
    }
    const m = Math.round(num(ctx.post('montant')));
    if (!ctx.post('depense') || m <= 0) ctx.flash('Choisissez la dépense et saisissez le montant.', 'err');
    else if (await fermee(C.today())) ctx.flash(`La caisse du jour est déjà fermée pour ${ag}.`, 'err');
    else { await C.q('INSERT INTO t_sortieargent (depense, motif, montantdepense, datedepenses, utilisateur, structures) VALUES (?,?,?,CURRENT_DATE,?,?)', [ctx.post('depense'), ctx.post('motif').slice(0, 50), m, ctx.uname(), ag]); ctx.flash(`Dépense de ${money(m)} FCFA enregistrée.`); }
    ctx.redirect(back);
  }
  const types = [...new Set((await C.rows("SELECT depense FROM t_depenses WHERE structures IN ('', ?) OR structures IS NULL ORDER BY depense", [ag])).map(r => r.depense))];
  const edit = ctx.get('id') && ctx.canEdit() ? await C.row('SELECT * FROM t_sortieargent WHERE idt_sortieargent = ? AND structures = ?', [Number(ctx.get('id')), ag]) : null;
  if (edit && !types.includes(edit.depense)) types.push(edit.depense);
  const list = await C.rows("SELECT * FROM t_sortieargent WHERE structures = ? AND datedepenses >= CURRENT_DATE - 30 ORDER BY datedepenses DESC, idt_sortieargent DESC", [ag]);
  const jour = list.filter(d => d.datedepenses === C.today());
  return `<h1 class="page-title">${edit ? 'Modifier une dépense' : "Sortie d'argent"}</h1>
<form method="post" class="card" style="max-width:640px;margin-inline:auto" ${edit ? 'data-confirm="modify"' : ''}>${ctx.csrfField()}<input type="hidden" name="id" value="${edit?.idt_sortieargent || 0}">
  <p style="text-align:center"><b>${C.dfr(edit ? edit.datedepenses : C.today())}</b></p>
  <div class="f"><label>Agence</label><select name="agence">${ctx.agOptions(ag)}</select></div>
  <div class="row" style="margin-top:.7rem"><div class="f"><label>Dépenses</label><select name="depense" id="dep" required>${C.selOptions(types, edit?.depense)}</select></div><button type="button" class="btn" id="adddep">Ajouter dépense</button></div>
  <div class="f" style="margin-top:.7rem"><label>Montant</label><input name="montant" class="big" inputmode="numeric" required value="${edit?.montantdepense || 0}"></div>
  <div class="f" style="margin-top:.7rem"><label>Motif</label><textarea name="motif" rows="3" maxlength="50">${e(edit?.motif)}</textarea></div>
  <div class="actions"><a class="btn ghost" href="/gestion${edit ? back : ''}">${edit ? 'Annuler' : 'Retour'}</a><button class="btn">${edit ? 'Modifier' : 'Valider'}</button></div></form>
<div class="card"><h2>Dépenses du jour — total ${money(jour.reduce((s, d) => s + d.montantdepense, 0))} FCFA <small class="hint">(liste des 30 derniers jours)</small></h2><div class="tbl-wrap"><table class="tbl grey"><thead><tr><th>Date</th><th>Dépense</th><th>Motif</th><th class="r">Montant</th><th>Utilisateur</th>${ctx.canEdit() ? '<th></th>' : ''}</tr></thead><tbody>
${list.map(d => `<tr><td>${C.dfr(d.datedepenses)}</td><td>${e(d.depense)}</td><td>${e(d.motif)}</td><td class="r">${money(d.montantdepense)}</td><td>${e(d.utilisateur)}</td>${ctx.canEdit() ? `<td class="r" style="white-space:nowrap"><a class="btn sm" href="/gestion${back}&id=${d.idt_sortieargent}">Modifier</a>
  <form method="post" style="display:inline" data-confirm="delete">${ctx.csrfField()}<input type="hidden" name="agence" value="${e(ag)}"><button class="btn sm red" name="del" value="${d.idt_sortieargent}">Supprimer</button></form></td>` : ''}</tr>`).join('') || `<tr><td colspan="6" class="empty">Aucune dépense sur les 30 derniers jours.</td></tr>`}</tbody></table></div></div>
<script>document.getElementById('adddep').onclick=function(){var d=prompt('Nouveau type de dépense :');if(!d)return;KFN.post('/gestion/api?a=add_depense',{depense:d,agence:document.querySelector('[name=agence]').value}).then(function(r){if(r.error){KFN.toast(r.error,'err');return;}document.getElementById('dep').add(new Option(r.depense,r.depense,true,true));KFN.toast('Dépense ajoutée.');});};</script>`;
};
