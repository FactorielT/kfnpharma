'use strict';
const C = require('../core'); const WA = require('../whatsapp'); const { e } = C;
module.exports = async ctx => {
  ctx.title = 'Paramétrage des agences';
  const usage = async nom => ({
    factures: Number(await C.val('SELECT COUNT(*) FROM t_commande WHERE structures = ? OR (structures = ? AND nomprenom = ?)', [nom, C.SIEGE, nom])),
    stock: Number(await C.val('SELECT COUNT(*) FROM t_stock WHERE structures = ?', [nom])),
    appros: Number(await C.val('SELECT COUNT(*) FROM t_precommandeagence WHERE structures = ?', [nom])) + Number(await C.val('SELECT COUNT(*) FROM t_appro WHERE structures = ?', [nom])),
    users: Number(await C.val('SELECT COUNT(DISTINCT idutilisateurs) FROM t_affectation WHERE structures = ?', [nom])),
  });
  if (ctx.req.method === 'POST') {
    if (ctx.post('del')) {
      const a = await C.row('SELECT * FROM t_structure WHERE idt_structure = ?', [Number(ctx.post('del'))]);
      if (!a) ctx.flash('Agence introuvable.', 'err');
      else if (a.estsiege || a.nom_structure === C.SIEGE) ctx.flash("L'agence siège ne peut pas être supprimée.", 'err');
      else {
        const u = await usage(a.nom_structure);
        if (u.factures || u.appros || u.users || Number(await C.val('SELECT COUNT(*) FROM t_stock WHERE structures = ? AND quantitestock <> 0', [a.nom_structure])))
          ctx.flash(`Suppression impossible : l'agence « ${a.nom_structure} » a déjà des factures, approvisionnements, stocks ou utilisateurs. Vous pouvez la renommer ou modifier ses paramètres.`, 'err');
        else { await C.tx(async () => { await C.q('DELETE FROM t_stock WHERE structures = ?', [a.nom_structure]); await C.q('DELETE FROM t_client WHERE structures = ?', [a.nom_structure]); await C.q('DELETE FROM t_structure WHERE idt_structure = ?', [a.idt_structure]); }); ctx.flash(`Agence « ${a.nom_structure} » supprimée.`); }
      }
      ctx.redirect('?p=agences');
    }
    const id = Number(ctx.post('id')) || 0, nom = ctx.post('nom').toUpperCase(), code = ctx.post('code').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const ret = '?p=agences' + (id ? '&id=' + id : '');
    if (!nom || !code) { ctx.flash("Renseignez le nom de l'agence et son code court.", 'err'); ctx.redirect(ret); }
    if (Number(await C.val('SELECT COUNT(*) FROM t_structure WHERE nom_structure = ? AND idt_structure <> ?', [nom, id]))) { ctx.flash('Une agence porte déjà ce nom.', 'err'); ctx.redirect(ret); }
    if (Number(await C.val('SELECT COUNT(*) FROM t_structure WHERE codecourt = ? AND idt_structure <> ?', [code, id]))) { ctx.flash('Ce code court est déjà utilisé par une autre agence.', 'err'); ctx.redirect(ret); }
    const r = await C.tx(async () => {
      if (id) {
        const a = await C.row('SELECT * FROM t_structure WHERE idt_structure = ? FOR UPDATE', [id]), old = a.nom_structure;
        if (old !== nom && (a.estsiege || old === C.SIEGE)) return { err: "Le nom de l'agence siège ne peut pas être changé (il est utilisé par le programme)." };
        await C.q('UPDATE t_structure SET nom_structure = ?, codecourt = ?, contact = ?, email = ?, whatsapp = ? WHERE idt_structure = ?', [nom, code, ctx.post('contact'), ctx.post('email'), WA.liste(ctx.post('whatsapp')).join(', '), id]);
        if (old !== nom) {   // renommage : toutes les tables, y compris les factures du siège (l'agence y est cliente)
          const cols = await C.rows("SELECT table_name t, column_name c FROM information_schema.columns WHERE table_schema = 'public' AND column_name IN ('structures','codearticles','structuresannee','structuresdatefermer') AND table_name <> 't_structure'");
          for (const { t, c } of cols) {
            if (c === 'structures') await C.q(`UPDATE ${t} SET structures = ? WHERE structures = ?`, [nom, old]);
            else await C.q(`UPDATE ${t} SET ${c} = ? || SUBSTRING(${c} FROM ?) WHERE ${c} LIKE ?`, [nom, old.length + 1, old.replace(/[%_\\]/g, '\\$&') + '%']);
          }
          await C.q('UPDATE t_commande SET nomprenom = ? WHERE structures = ? AND nomprenom = ?', [nom, C.SIEGE, old]);
          for (const t of ['t_paiement', 't_paiement_sl']) await C.q(`UPDATE ${t} SET client = ? WHERE structures = ? AND client = ?`, [nom, C.SIEGE, old]);
          if (ctx.ustruct() === old) ctx.req.session.user.structures = nom;
        }
        return { msg: `Agence « ${nom} » modifiée.` + (old !== nom ? ` L'ancien nom « ${old} » a été remplacé dans toutes les données.` : '') };
      }
      await C.q('INSERT INTO t_structure (nom_structure, contact, email, codecourt, estsiege, whatsapp) VALUES (?,?,?,?,0,?)', [nom, ctx.post('contact'), ctx.post('email'), code, WA.liste(ctx.post('whatsapp')).join(', ')]);
      let n = 0;
      if (ctx.post('generer')) n = (await C.q(`INSERT INTO t_stock (refarticles, libarticles, quantitestock, quantitealerte, unitevaleur, structures, codearticles, prixachat, prixvente, familearticle, activer)
        SELECT refarticles, libarticles, 0, quantitealerte, unitevaleur, ?, ? || refarticles, prixvente, prixvente, familearticle, 1 FROM t_stock WHERE structures = ?`, [nom, nom, C.SIEGE])).rowCount;
      if (ctx.post('client')) await C.q("INSERT INTO t_client (nomprenom, structures) VALUES ('CLIENT COMPTANT', ?)", [nom]);
      return { msg: `Agence « ${nom} » créée${n ? ` avec ${n} article(s) dans son stock` : ''}. Elle devient automatiquement cliente du siège.` };
    });
    if (r.err) { ctx.flash(r.err, 'err'); ctx.redirect(ret); }
    ctx.flash(r.msg); ctx.redirect('?p=agences');
  }
  const edit = ctx.get('id') ? await C.row('SELECT * FROM t_structure WHERE idt_structure = ?', [Number(ctx.get('id'))]) : null;
  const list = await C.rows('SELECT * FROM t_structure ORDER BY estsiege DESC, nom_structure');
  const us = await Promise.all(list.map(a => usage(a.nom_structure)));
  return `<h1 class="page-title">${edit ? "Modifier l'agence " + e(edit.nom_structure) : 'Créer une agence'}</h1>
<div class="card"><form method="post" class="grid g4" ${edit ? 'data-confirm="modify"' : ''}>${ctx.csrfField()}<input type="hidden" name="id" value="${edit?.idt_structure || 0}">
  <div class="f span2"><label>Nom de l'agence</label><input name="nom" required value="${e(edit?.nom_structure)}" ${edit?.estsiege ? 'readonly' : ''} placeholder="Ex : KORHOGO"></div>
  <div class="f"><label>Code court (numéros de factures)</label><input name="code" required maxlength="6" value="${e(edit?.codecourt)}" placeholder="Ex : KOR" style="text-transform:uppercase"></div>
  <div class="f"><label>Contact</label><input name="contact" inputmode="tel" value="${e(edit?.contact)}"></div>
  <div class="f"><label>WhatsApp (notifications)</label><input name="whatsapp" inputmode="tel" value="${e(edit?.whatsapp)}" placeholder="Ex : 07 08 56 36 57"></div><div class="f span2"><label>E-mail</label><input name="email" type="email" value="${e(edit?.email)}"></div>
  ${edit ? '' : `<div class="f span2" style="display:grid;gap:.4rem;align-content:end"><label style="display:flex;gap:.5rem;align-items:center;color:var(--ink)"><input type="checkbox" name="generer" value="1" checked> Générer son stock à partir des articles du siège</label>
    <label style="display:flex;gap:.5rem;align-items:center;color:var(--ink)"><input type="checkbox" name="client" value="1" checked> Créer le client « CLIENT COMPTANT » de l'agence</label></div>`}
  <div class="f" style="display:flex;gap:.5rem;align-items:flex-end"><button class="btn">${edit ? 'Modifier' : 'Valider'}</button>${edit ? '<a class="btn ghost" href="/gestion?p=agences">Annuler</a>' : ''}</div></form>
<p class="hint">Chaque agence a ses propres clients ; toutes les agences sont les clientes du siège. Le code court sert de suffixe aux numéros (ex. F261007-12<b>KOR</b>).</p></div>
<div class="card"><div class="tbl-wrap"><table class="tbl grey"><thead><tr><th>Agence</th><th>Code</th><th>Contact</th><th>E-mail</th><th class="r">Articles en stock</th><th class="r">Factures</th><th class="r">Utilisateurs</th><th>Actions</th></tr></thead><tbody>
${list.map((a, i) => `<tr><td><b>${e(a.nom_structure)}</b>${a.estsiege ? ' <span class="badge">Siège</span>' : ''}</td><td>${e(a.codecourt)}</td><td>${e(a.contact)}</td><td>${e(a.email)}</td><td class="r">${us[i].stock}</td><td class="r">${us[i].factures}</td><td class="r">${us[i].users}</td>
<td style="white-space:nowrap"><a class="btn sm" href="/gestion?p=agences&id=${a.idt_structure}">Modifier</a> ${a.estsiege ? '' : `<form method="post" style="display:inline" data-confirm="delete">${ctx.csrfField()}<button class="btn sm red" name="del" value="${a.idt_structure}">Supprimer</button></form>`}</td></tr>`).join('')}</tbody></table></div></div>`;
};
