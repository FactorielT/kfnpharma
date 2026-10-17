'use strict';
const C = require('../core'); const { e, money } = C;
module.exports = async ctx => {
  ctx.title = 'Clients';
  const ag = ctx.agenceOk(ctx.get('agence') || ctx.post('agence'));
  if (ag === C.SIEGE) {   // Au siège, les clients sont les agences
    const list = await C.rows(`SELECT s.nom_structure AS nom, s.codecourt, s.contact, s.email,
        (SELECT COUNT(*) FROM t_commande k WHERE k.structures = ? AND k.nomprenom = s.nom_structure) AS nb,
        (SELECT COALESCE(SUM(mtapayer),0) FROM t_commande k WHERE k.structures = ? AND k.nomprenom = s.nom_structure) AS total,
        (SELECT COALESCE(SUM(reste),0) FROM t_commande k WHERE k.structures = ? AND k.nomprenom = s.nom_structure) AS reste
      FROM t_structure s WHERE s.nom_structure <> ? ORDER BY s.nom_structure`, [C.SIEGE, C.SIEGE, C.SIEGE, C.SIEGE]);
    return `<h1 class="page-title">Clients du siège : les agences</h1>
<div class="card"><form method="get" action="/gestion" class="row" style="margin-bottom:.7rem"><input type="hidden" name="p" value="clients"><div class="f"><select name="agence" data-autosubmit>${ctx.agOptions(ag)}</select></div></form>
<div class="flash info">Les clients de l'<b>AGENCE SIEGE</b> sont les autres agences : seules elles peuvent être facturées et payer à la caisse du siège.
Pour ajouter un client du siège, créez une agence dans <b>ADMIN → Paramétrage des agences</b>.</div>
<div class="tbl-wrap"><table class="tbl grey"><thead><tr><th>Agence cliente</th><th>Code</th><th>Contact</th><th>E-mail</th><th class="r">Factures</th><th class="r">Total facturé</th><th class="r">Reste à payer</th><th></th></tr></thead><tbody>
${list.map(c => `<tr><td><b>${e(c.nom)}</b></td><td>${e(c.codecourt)}</td><td>${e(c.contact)}</td><td>${e(c.email)}</td><td class="r">${c.nb}</td><td class="r">${money(c.total)}</td><td class="r ${c.reste > 0 ? 'neg' : ''}">${money(c.reste)}</td>
<td class="r"><a class="btn sm" href="/gestion?p=compte_agences&agence=${encodeURIComponent(c.nom)}">Compte</a></td></tr>`).join('')}</tbody></table></div></div>`;
  }
  if (ctx.req.method === 'POST') {
    const id = Number(ctx.post('id')) || 0, nom = ctx.post('nom').toUpperCase();
    if (ctx.post('del')) {
      const c = await C.row('SELECT * FROM t_client WHERE idt_client = ? AND structures = ?', [Number(ctx.post('del')), ag]);
      if (c && Number(await C.val('SELECT COUNT(*) FROM t_commande WHERE nomprenom = ? AND structures = ?', [c.nomprenom, ag]))) ctx.flash('Ce client a des factures : suppression impossible.', 'err');
      else if (c) { await C.q('DELETE FROM t_client WHERE idt_client = ?', [c.idt_client]); ctx.flash('Client supprimé.'); }
    } else if (!nom) ctx.flash('Saisissez le nom du client.', 'err');
    else if (id) { await C.q('UPDATE t_client SET nomprenom=?, quartier=?, contact=?, email=? WHERE idt_client=? AND structures=?', [nom, ctx.post('quartier'), ctx.post('contact'), ctx.post('email'), id, ag]); ctx.flash('Client modifié.'); }
    else { await C.q('INSERT INTO t_client (nomprenom, contact, quartier, email, structures) VALUES (?,?,?,?,?)', [nom, ctx.post('contact'), ctx.post('quartier'), ctx.post('email'), ag]); ctx.flash(`Client ${nom} enregistré.`); }
    ctx.redirect('?p=clients&agence=' + encodeURIComponent(ag));
  }
  const edit = ctx.get('id') ? await C.row('SELECT * FROM t_client WHERE idt_client = ? AND structures = ?', [Number(ctx.get('id')), ag]) : null;
  const list = await C.rows('SELECT c.*, (SELECT COALESCE(SUM(reste),0) FROM t_commande k WHERE k.nomprenom = c.nomprenom AND k.structures = c.structures) AS reste FROM t_client c WHERE structures = ? ORDER BY nomprenom', [ag]);
  return `<h1 class="page-title">Enregistrement des clients — ${e(ag)}</h1>
<div class="card"><form method="post" class="grid g3" ${edit ? 'data-confirm="modify"' : ''}>${ctx.csrfField()}<input type="hidden" name="id" value="${edit?.idt_client || 0}">
  <div class="f"><label>Agence</label><select name="agence">${ctx.agOptions(ag)}</select></div>
  <div class="f"><label>Nom prénoms client</label><input name="nom" required value="${e(edit?.nomprenom)}"></div>
  <div class="f"><label>Localité</label><input name="quartier" value="${e(edit?.quartier)}"></div>
  <div class="f"><label>Contact</label><input name="contact" inputmode="tel" value="${e(edit?.contact)}"></div>
  <div class="f"><label>E-mail</label><input name="email" type="email" value="${e(edit?.email)}"></div>
  <div class="f" style="display:flex;gap:.5rem;align-items:flex-end"><button class="btn">${edit ? 'Modifier' : 'Valider'}</button>${edit ? `<a class="btn ghost" href="/gestion?p=clients&agence=${encodeURIComponent(ag)}">Annuler</a>` : ''}</div></form>
  <p class="hint">Chaque agence a ses propres clients.</p></div>
<h1 class="page-title">Liste des clients — ${e(ag)} (${list.length})</h1>
<div class="card"><form method="get" action="/gestion" class="row" style="margin-bottom:.7rem"><input type="hidden" name="p" value="clients">
  <div class="f"><select name="agence" data-autosubmit>${ctx.agOptions(ag)}</select></div><div class="f"><input placeholder="Rechercher un client…" data-filter="#tc"></div></form>
<div class="tbl-wrap"><table class="tbl grey" id="tc"><thead><tr><th>Nom prénoms</th><th>Localité</th><th>Contact</th><th>E-mail</th><th class="r">Reste à payer</th><th></th></tr></thead><tbody>
${list.map(c => `<tr><td><b>${e(c.nomprenom)}</b></td><td>${e(c.quartier)}</td><td>${e(c.contact)}</td><td>${e(c.email)}</td><td class="r ${c.reste > 0 ? 'neg' : ''}">${money(c.reste)}</td>
<td class="r" style="white-space:nowrap"><a class="btn sm" href="/gestion?p=clients&agence=${encodeURIComponent(ag)}&id=${c.idt_client}">Modifier</a> <form method="post" style="display:inline" data-confirm="delete">${ctx.csrfField()}<input type="hidden" name="agence" value="${e(ag)}"><button class="btn sm red" name="del" value="${c.idt_client}">×</button></form></td></tr>`).join('')}
</tbody></table></div></div>`;
};
