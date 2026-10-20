'use strict';
/* ADMIN : Utilisateurs — un utilisateur peut être affecté à une ou plusieurs agences, avec un profil par agence.
   Il choisit ensuite « Travailler en tant que » (agence + profil) depuis la barre du haut. */
const C = require('../core'); const bcrypt = require('bcryptjs'); const { e } = C;
const DESC = { SUP: 'Peut tout faire (réservé au développeur).', ADM: 'Tout, sauf modifier ou supprimer dans « Modification des fichiers ».', RAG: 'Caissier(ère) + Vendeur(se) + Consultation + Gestionnaire stock de son agence.', GST: 'Uniquement ce qui concerne le stock.', CAI: 'Caissier(ère) + Consultation.', VEN: 'Vendeur(se) + Consultation.', CON: 'Peut consulter les états.' };
module.exports = async ctx => {
  ctx.title = 'Utilisateurs';
  const structs = (await C.rows('SELECT nom_structure FROM t_structure ORDER BY estsiege DESC, nom_structure')).map(r => r.nom_structure);
  const profils = { ...C.NIVEAUX }; if (!ctx.isSuper()) delete profils.SUP;
  const moi = Number(ctx.user.idutilisateurs);
  const affsDe = id => C.rows('SELECT * FROM t_affectation WHERE idutilisateurs = ? ORDER BY principale DESC, idaffectation', [id]);
  const cible = async id => {
    const u = await C.row('SELECT * FROM utilisateurs WHERE idutilisateurs = ?', [id]);
    if (!u) { ctx.flash('Utilisateur introuvable.', 'err'); ctx.redirect('?p=utilisateurs'); }
    if ((u.niveaudacces === 'SUP' || (await affsDe(id)).some(a => a.niveaudacces === 'SUP')) && !ctx.isSuper()) { ctx.flash('Seul le Super Admin peut agir sur ce compte.', 'err'); ctx.redirect('?p=utilisateurs'); }
    return u;
  };
  if (ctx.req.method === 'POST') {
    if (ctx.post('del')) {
      const u = await cible(Number(ctx.post('del')));
      if (Number(u.idutilisateurs) === moi) ctx.flash('Vous ne pouvez pas supprimer votre propre compte.', 'err');
      else { await C.tx(async () => { await C.q('DELETE FROM t_affectation WHERE idutilisateurs = ?', [u.idutilisateurs]); await C.q('DELETE FROM utilisateurs WHERE idutilisateurs = ?', [u.idutilisateurs]); }); ctx.flash(`Utilisateur « ${u.login} » supprimé.`); }
      ctx.redirect('?p=utilisateurs');
    }
    if (ctx.post('toggle')) {
      const u = await cible(Number(ctx.post('toggle')));
      if (Number(u.idutilisateurs) === moi) ctx.flash('Vous ne pouvez pas désactiver votre propre compte.', 'err');
      else { await C.q('UPDATE utilisateurs SET actif_life = 1 - actif_life WHERE idutilisateurs = ?', [u.idutilisateurs]); ctx.flash(`Compte « ${u.login} » ${u.actif_life ? 'désactivé.' : 'activé.'}`); }
      ctx.redirect('?p=utilisateurs');
    }
    const id = Number(ctx.post('id')) || 0; if (id) await cible(id);
    const ret = '?p=utilisateurs' + (id ? '&id=' + id : '');
    const nom = ctx.post('nom').toUpperCase(), login = ctx.post('login'), pass = String(ctx.B.mdp || '');
    // affectations : lignes agence + profil ; la ligne « principale » est l'agence de travail par défaut
    const ags = ctx.arr('aff_ag'), nivs = ctx.arr('aff_niv'), princ = Number(ctx.post('principale') || 0);
    const vus = new Set(), affs = [];
    ags.forEach((a, i) => { const n = nivs[i]; if (!a || !n) return; const k = a + '|' + n; if (vus.has(k)) return; vus.add(k); affs.push({ ag: a, niv: n, p: i === princ }); });
    if (!nom || !login) { ctx.flash('Renseignez le nom et le login.', 'err'); ctx.redirect(ret); }
    if (!affs.length) { ctx.flash('Ajoutez au moins une affectation (agence + profil).', 'err'); ctx.redirect(ret); }
    if (affs.some(a => !structs.includes(a.ag) || !profils[a.niv])) { ctx.flash('Une affectation contient une agence ou un profil non autorisé.', 'err'); ctx.redirect(ret); }
    if (!affs.some(a => a.p)) affs[0].p = true;
    if (Number(await C.val('SELECT COUNT(*) FROM utilisateurs WHERE login = ? AND idutilisateurs <> ?', [login, id]))) { ctx.flash('Ce login est déjà utilisé.', 'err'); ctx.redirect(ret); }
    if ((!id || pass) && pass.length < 6) { ctx.flash('Le mot de passe doit contenir au moins 6 caractères.', 'err'); ctx.redirect(ret); }
    const pr = affs.find(a => a.p);
    await C.tx(async () => {
      let uid = id;
      if (id) {
        await C.q('UPDATE utilisateurs SET nom_prenoms=?, niveaudacces=?, login=?, structures=?, groupe=? WHERE idutilisateurs=?', [nom, pr.niv, login, pr.ag, C.NIVEAUX[pr.niv], id]);
        if (pass) await C.q('UPDATE utilisateurs SET mot_de_passe=? WHERE idutilisateurs=?', [await bcrypt.hash(pass, 10), id]);
      } else uid = await C.val('INSERT INTO utilisateurs (nom_prenoms, niveaudacces, login, mot_de_passe, actif_life, groupe, structures) VALUES (?,?,?,?,1,?,?) RETURNING idutilisateurs', [nom, pr.niv, login, await bcrypt.hash(pass, 10), C.NIVEAUX[pr.niv], pr.ag]);
      await C.q('DELETE FROM t_affectation WHERE idutilisateurs = ?', [uid]);
      for (const a of affs) await C.q('INSERT INTO t_affectation (idutilisateurs, structures, niveaudacces, principale) VALUES (?,?,?,?)', [uid, a.ag, a.niv, a.p ? 1 : 0]);
      if (uid === moi) {   // ma propre fiche : je reste sur mon affectation active si elle existe encore
        const cur = ctx.req.session.user, garde = affs.find(a => a.ag === cur.structures && a.niv === C.level(cur)) || pr;
        Object.assign(cur, { nom_prenoms: nom, login, structures: garde.ag, niveaudacces: garde.niv });
      }
    });
    ctx.flash(`Utilisateur « ${login} » ${id ? 'modifié' : 'créé'} : ${affs.length} affectation(s).`);
    ctx.redirect('?p=utilisateurs');
  }
  let edit = ctx.get('id') ? await C.row('SELECT * FROM utilisateurs WHERE idutilisateurs = ?', [Number(ctx.get('id'))]) : null;
  let editAffs = edit ? await affsDe(edit.idutilisateurs) : [];
  if (edit && editAffs.some(a => a.niveaudacces === 'SUP') && !ctx.isSuper()) { edit = null; editAffs = []; }
  if (!editAffs.length) editAffs = [{ structures: edit?.structures || '', niveaudacces: C.level(edit) || 'RAG', principale: 1 }];
  const list = await C.rows('SELECT * FROM utilisateurs ORDER BY nom_prenoms');
  const allAffs = await C.rows('SELECT * FROM t_affectation ORDER BY principale DESC, structures');
  const parUser = {}; for (const a of allAffs) (parUser[a.idutilisateurs] ||= []).push(a);
  const ligne = (a, i) => `<tr><td class="c"><input type="radio" name="principale" value="${i}" ${a.principale ? 'checked' : ''} aria-label="Agence principale"></td>
    <td><select name="aff_ag" required>${C.selOptions(structs, a.structures, true, '— Agence —')}</select></td>
    <td><select name="aff_niv" required>${C.selOptions(profils, a.niveaudacces, false)}</select></td>
    <td class="r"><button type="button" class="btn sm red rmaff">Retirer</button></td></tr>`;
  return `<h1 class="page-title">${edit ? 'Modifier un utilisateur' : "Création d'utilisateur"}</h1>
<div class="card"><form method="post" id="fu" autocomplete="off" ${edit ? 'data-confirm="modify"' : ''}>${ctx.csrfField()}<input type="hidden" name="id" value="${edit?.idutilisateurs || 0}">
  <div class="grid g3"><div class="f"><label>Nom et prénoms</label><input name="nom" required value="${e(edit?.nom_prenoms)}"></div>
  <div class="f"><label>Login</label><input name="login" required autocapitalize="none" value="${e(edit?.login)}"></div>
  <div class="f"><label>Mot de passe ${edit ? '(vide = inchangé)' : ''}</label><input type="password" name="mdp" autocomplete="new-password" ${edit ? '' : 'required minlength="6"'}></div></div>
  <h2 style="margin-top:1.2rem">Agences et profils de cet utilisateur</h2>
  <p class="hint" style="margin-top:0">Un utilisateur peut être configuré dans <b>une ou plusieurs agences</b>, avec un profil par agence. Il choisit ensuite « <b>Travailler en tant que</b> » dans la barre du haut. L'agence <b>principale</b> est celle utilisée par défaut.</p>
  <div class="tbl-wrap" style="max-height:none"><table class="tbl grey" id="taff"><thead><tr><th class="c">Principale</th><th>Agence</th><th>Profil</th><th></th></tr></thead><tbody>${editAffs.map(ligne).join('')}</tbody></table></div>
  <div class="row" style="justify-content:space-between;margin-top:.7rem"><button type="button" class="btn ghost" id="addaff">+ Ajouter une agence / un profil</button>
    <div class="row"><button class="btn">${edit ? 'Modifier' : 'Valider'}</button>${edit ? '<a href="/gestion?p=utilisateurs" class="btn ghost">Annuler</a>' : ''}</div></div>
  <p class="hint" id="roleinfo"></p></form></div>
<div class="card"><div class="row" style="margin-bottom:.7rem"><div class="f"><input placeholder="Rechercher un utilisateur, une agence…" data-filter="#tu"></div></div>
<div class="tbl-wrap"><table class="tbl grey" id="tu"><thead><tr><th>Nom</th><th>Login</th><th>Agences et profils</th><th>Travaille actuellement en tant que</th><th>Dernière connexion</th><th>État</th><th>Actions</th></tr></thead><tbody>
${list.map(u => { const af = parUser[u.idutilisateurs] || [], prot = af.some(a => a.niveaudacces === 'SUP') && !ctx.isSuper(), self = Number(u.idutilisateurs) === moi;
  return `<tr><td>${e(u.nom_prenoms)}</td><td>${e(u.login)}</td>
  <td style="white-space:normal;min-width:240px">${af.map(a => `<span class="badge${a.principale ? '' : ' o'}" style="margin:.1rem" title="${a.principale ? 'Agence principale' : ''}">${e(a.structures)} — ${e(C.NIVEAUX[a.niveaudacces] || a.niveaudacces)}${a.principale ? ' ★' : ''}</span>`).join(' ') || '<span class="badge r">Aucune</span>'}</td>
  <td>${e(u.structures)} — ${e(C.NIVEAUX[C.level(u)] || C.level(u))}</td><td>${u.derniere_cnx ? e(String(u.derniere_cnx).slice(0, 16)) : '—'}</td><td>${u.actif_life ? '<span class="badge">Actif</span>' : '<span class="badge r">Désactivé</span>'}</td>
  <td style="white-space:nowrap">${prot ? '<span class="hint">Protégé</span>' : `<a class="btn sm" href="/gestion?p=utilisateurs&id=${u.idutilisateurs}">Modifier</a> ${self ? '<span class="hint">(vous)</span>' : `<form method="post" style="display:inline" data-confirm="modify">${ctx.csrfField()}<button class="btn sm ${u.actif_life ? 'orange' : 'green'}" name="toggle" value="${u.idutilisateurs}">${u.actif_life ? 'Désactiver' : 'Activer'}</button></form>
  <form method="post" style="display:inline" data-confirm="delete">${ctx.csrfField()}<button class="btn sm red" name="del" value="${u.idutilisateurs}">Supprimer</button></form>`}`}</td></tr>`; }).join('')}</tbody></table></div></div>
<template id="tplaff">${ligne({ structures: '', niveaudacces: 'VEN', principale: 0 }, 0)}</template>
<script>
(function(){var R=${JSON.stringify(DESC)},tb=document.querySelector('#taff tbody');
  function renum(){tb.querySelectorAll('input[name=principale]').forEach(function(r,i){r.value=i;});if(!tb.querySelector('input[name=principale]:checked')&&tb.rows[0])tb.rows[0].querySelector('input[name=principale]').checked=true;
    tb.querySelectorAll('.rmaff').forEach(function(b){b.disabled=tb.rows.length<2;});info();}
  function info(){var h=[];tb.querySelectorAll('select[name=aff_niv]').forEach(function(s){var t=s.selectedOptions[0].text;if(h.indexOf(t)<0)h.push(t);});
    document.getElementById('roleinfo').innerHTML=h.map(function(t){var k=Object.keys(R).filter(function(x){return document.querySelector('select[name=aff_niv] option[value='+x+']')&&document.querySelector('select[name=aff_niv] option[value='+x+']').text===t;})[0];return '<b>'+KFN.esc(t)+'</b> : '+KFN.esc(R[k]||'');}).join('<br>');}
  document.getElementById('addaff').onclick=function(){var t=document.getElementById('tplaff').content.cloneNode(true);t.querySelector('input[name=principale]').checked=false;tb.appendChild(t);renum();};
  tb.addEventListener('click',function(e){var b=e.target.closest('.rmaff');if(b&&tb.rows.length>1){b.closest('tr').remove();renum();}});
  tb.addEventListener('change',info);renum();})();
</script>`;
};
