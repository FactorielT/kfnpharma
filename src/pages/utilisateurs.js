'use strict';
const C = require('../core'); const bcrypt = require('bcryptjs'); const { e } = C;
const DESC = { SUP: 'Peut tout faire (réservé au développeur).', ADM: 'Tout, sauf modifier ou supprimer dans « Modification des fichiers ».', RAG: 'Caissier(ère) + Vendeur(se) + Consultation + Gestionnaire stock de son agence.', GST: 'Uniquement ce qui concerne le stock.', CAI: 'Caissier(ère) + Consultation.', VEN: 'Vendeur(se) + Consultation.', CON: 'Peut consulter les états.' };
module.exports = async ctx => {
  ctx.title = 'Utilisateurs';
  const structs = (await C.rows('SELECT nom_structure FROM t_structure ORDER BY estsiege DESC, nom_structure')).map(r => r.nom_structure);
  const profils = { ...C.NIVEAUX }; if (!ctx.isSuper()) delete profils.SUP;
  const moi = Number(ctx.user.idutilisateurs);
  const cible = async id => {
    const u = await C.row('SELECT * FROM utilisateurs WHERE idutilisateurs = ?', [id]);
    if (!u) { ctx.flash('Utilisateur introuvable.', 'err'); ctx.redirect('?p=utilisateurs'); }
    if (u.niveaudacces === 'SUP' && !ctx.isSuper()) { ctx.flash('Seul le Super Admin peut agir sur ce compte.', 'err'); ctx.redirect('?p=utilisateurs'); }
    return u;
  };
  if (ctx.req.method === 'POST') {
    if (ctx.post('del')) {
      const u = await cible(Number(ctx.post('del')));
      if (Number(u.idutilisateurs) === moi) ctx.flash('Vous ne pouvez pas supprimer votre propre compte.', 'err');
      else { await C.q('DELETE FROM utilisateurs WHERE idutilisateurs = ?', [u.idutilisateurs]); ctx.flash(`Utilisateur « ${u.login} » supprimé.`); }
      ctx.redirect('?p=utilisateurs');
    }
    if (ctx.post('toggle')) {
      const u = await cible(Number(ctx.post('toggle')));
      if (Number(u.idutilisateurs) === moi) ctx.flash('Vous ne pouvez pas désactiver votre propre compte.', 'err');
      else { await C.q('UPDATE utilisateurs SET actif_life = 1 - actif_life WHERE idutilisateurs = ?', [u.idutilisateurs]); ctx.flash(`Compte « ${u.login} » ${u.actif_life ? 'désactivé.' : 'activé.'}`); }
      ctx.redirect('?p=utilisateurs');
    }
    const id = Number(ctx.post('id')) || 0; if (id) await cible(id);
    const nom = ctx.post('nom').toUpperCase(), niv = ctx.post('niveau'), login = ctx.post('login'), st = ctx.post('structure'), pass = String(ctx.B.mdp || '');
    const ret = '?p=utilisateurs' + (id ? '&id=' + id : '');
    if (!nom || !login || !profils[niv] || !structs.includes(st)) { ctx.flash('Renseignez le nom, le login, le profil et l’agence.', 'err'); ctx.redirect(ret); }
    if (Number(await C.val('SELECT COUNT(*) FROM utilisateurs WHERE login = ? AND idutilisateurs <> ?', [login, id]))) { ctx.flash('Ce login est déjà utilisé.', 'err'); ctx.redirect(ret); }
    if ((!id || pass) && pass.length < 6) { ctx.flash('Le mot de passe doit contenir au moins 6 caractères.', 'err'); ctx.redirect(ret); }
    if (id) {
      await C.q('UPDATE utilisateurs SET nom_prenoms=?, niveaudacces=?, login=?, structures=?, groupe=? WHERE idutilisateurs=?', [nom, niv, login, st, C.NIVEAUX[niv], id]);
      if (pass) await C.q('UPDATE utilisateurs SET mot_de_passe=? WHERE idutilisateurs=?', [await bcrypt.hash(pass, 10), id]);
      if (id === moi) { const u = await C.row('SELECT * FROM utilisateurs WHERE idutilisateurs = ?', [id]); delete u.mot_de_passe; ctx.req.session.user = u; }
      ctx.flash(`Utilisateur « ${login} » modifié.`);
    } else {
      await C.q('INSERT INTO utilisateurs (nom_prenoms, niveaudacces, login, mot_de_passe, actif_life, groupe, structures) VALUES (?,?,?,?,1,?,?)', [nom, niv, login, await bcrypt.hash(pass, 10), C.NIVEAUX[niv], st]);
      ctx.flash(`Utilisateur « ${login} » créé.`);
    }
    ctx.redirect('?p=utilisateurs');
  }
  let edit = ctx.get('id') ? await C.row('SELECT * FROM utilisateurs WHERE idutilisateurs = ?', [Number(ctx.get('id'))]) : null;
  if (edit && edit.niveaudacces === 'SUP' && !ctx.isSuper()) edit = null;
  const list = await C.rows('SELECT * FROM utilisateurs ORDER BY structures, nom_prenoms');
  return `<h1 class="page-title">${edit ? 'Modifier un utilisateur' : "Création d'utilisateur"}</h1>
<div class="card"><form method="post" class="grid g3" autocomplete="off" ${edit ? 'data-confirm="modify"' : ''}>${ctx.csrfField()}<input type="hidden" name="id" value="${edit?.idutilisateurs || 0}">
  <div class="f"><label>Nom et prénoms</label><input name="nom" required value="${e(edit?.nom_prenoms)}"></div><div class="f"><label>Login</label><input name="login" required autocapitalize="none" value="${e(edit?.login)}"></div>
  <div class="f"><label>Mot de passe ${edit ? '(vide = inchangé)' : ''}</label><input type="password" name="mdp" autocomplete="new-password" ${edit ? '' : 'required minlength="6"'}></div>
  <div class="f"><label>Profil</label><select name="niveau" id="niv" required>${C.selOptions(profils, C.level(edit) || 'RAG', false)}</select></div>
  <div class="f"><label>Agence</label><select name="structure" required>${C.selOptions(structs, edit?.structures, false)}</select></div>
  <div class="f" style="display:flex;gap:.5rem;align-items:flex-end"><button class="btn">${edit ? 'Modifier' : 'Valider'}</button>${edit ? '<a href="/gestion?p=utilisateurs" class="btn ghost">Annuler</a>' : ''}</div></form><p class="hint" id="roleinfo"></p></div>
<div class="card"><div class="tbl-wrap"><table class="tbl grey"><thead><tr><th>Nom</th><th>Login</th><th>Profil</th><th>Agence</th><th>Dernière connexion</th><th>État</th><th>Actions</th></tr></thead><tbody>
${list.map(u => { const lv = C.level(u), prot = lv === 'SUP' && !ctx.isSuper(), self = Number(u.idutilisateurs) === moi; return `<tr><td>${e(u.nom_prenoms)}</td><td>${e(u.login)}</td><td>${e(C.NIVEAUX[lv] || lv)}</td><td>${e(u.structures)}</td>
  <td>${u.derniere_cnx ? e(String(u.derniere_cnx).slice(0, 16)) : '—'}</td><td>${u.actif_life ? '<span class="badge">Actif</span>' : '<span class="badge r">Désactivé</span>'}</td>
  <td style="white-space:nowrap">${prot ? '<span class="hint">Protégé</span>' : `<a class="btn sm" href="/gestion?p=utilisateurs&id=${u.idutilisateurs}">Modifier</a> ${self ? '<span class="hint">(vous)</span>' : `<form method="post" style="display:inline" data-confirm="modify">${ctx.csrfField()}<button class="btn sm ${u.actif_life ? 'orange' : 'green'}" name="toggle" value="${u.idutilisateurs}">${u.actif_life ? 'Désactiver' : 'Activer'}</button></form>
  <form method="post" style="display:inline" data-confirm="delete">${ctx.csrfField()}<button class="btn sm red" name="del" value="${u.idutilisateurs}">Supprimer</button></form>`}`}</td></tr>`; }).join('')}</tbody></table></div></div>
<script>(function(){var R=${JSON.stringify(DESC)},s=document.getElementById('niv'),h=document.getElementById('roleinfo');function u(){h.innerHTML='<b>'+KFN.esc(s.selectedOptions[0].text)+'</b> : '+KFN.esc(R[s.value]||'');}s.onchange=u;u();})();</script>`;
};
