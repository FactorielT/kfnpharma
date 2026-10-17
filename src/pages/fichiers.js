'use strict';
/* ADMIN : Modification des fichiers (tables façon Excel) */
const C = require('../core'); const T = require('../tables'); const bcrypt = require('bcryptjs'); const { e, money } = C;
const PRINC = { t_articles: 'Articles', t_stock: 'Stocks', t_lignecmde: 'Ligne commande', t_commande: 'Commandes', t_appro: 'Appro', t_paiement: 'Paiements', t_fermercaisse: 'Fermeture de caisse', t_proforma: 'Proforma cmde' };
module.exports = async ctx => {
  ctx.title = 'Modification des fichiers';
  const ecrire = ctx.isSuper(), toutes = await T.listTables();
  let t = ctx.get('t') || ctx.post('t');
  if (t && !toutes.includes(t)) { ctx.flash('Table inconnue.', 'err'); t = ''; }
  if (!t) {
    const cnt = {}; for (const x of toutes) cnt[x] = await C.val(`SELECT COUNT(*) FROM ${x}`);
    const tile = (k, l, st = '') => `<a class="tile"${st} href="/gestion?p=fichiers&t=${k}"><span>${e(l)}<small>${k} · ${money(cnt[k])} lignes</small></span></a>`;
    return `<h1 class="page-title">Modification des fichiers</h1><div class="card">
<p class="hint" style="margin-top:0">Choisissez une table : elle s'affiche comme une feuille Excel, du premier au dernier champ. ${ecrire ? 'Tous les champs sont modifiables ; sélectionnez une ligne pour la supprimer.' : '<b>Profil Administrateur : consultation seulement</b> (modification et suppression réservées au Super Admin).'}</p>
<div class="tiles">${Object.entries(PRINC).map(([k, l]) => tile(k, l)).join('')}</div><h2 style="margin-top:1.5rem">Toutes les autres tables de la base</h2>
<div class="tiles">${toutes.filter(x => !PRINC[x]).map(k => tile(k, k, ' style="background:#3B5998;min-height:54px;font-size:.85rem"')).join('')}</div></div>`;
  }
  const cols = await T.columns(t), pk = (cols.find(c => c.pk) || cols[0]).name, byName = Object.fromEntries(cols.map(c => [c.name, c]));
  const qs = ctx.get('q') || ctx.post('q'), o0 = ctx.get('o') || ctx.post('o'), d0 = ctx.get('d') || ctx.post('d');
  const back = `?p=fichiers&t=${t}&q=${encodeURIComponent(qs)}&pg=${Number(ctx.get('pg') || ctx.post('pg') || 1)}&o=${encodeURIComponent(o0)}&d=${encodeURIComponent(d0)}`;
  if (ctx.req.method === 'POST') {
    if (!ecrire) { ctx.flash('Seul le Super Admin peut modifier ou supprimer dans les fichiers.', 'err'); ctx.redirect(back); }
    const act = ctx.post('action');
    if (act === 'del') {
      const id = ctx.post('num');
      if (!id || !Number(await C.val(`SELECT COUNT(*) FROM ${t} WHERE ${pk}::text = ?`, [id]))) ctx.flash(`Aucun enregistrement N° ${id} dans ${t}.`, 'err');
      else if (t === 'utilisateurs' && Number(id) === Number(ctx.user.idutilisateurs)) ctx.flash('Vous ne pouvez pas supprimer votre propre compte.', 'err');
      else { await C.q(`DELETE FROM ${t} WHERE ${pk}::text = ?`, [id]); ctx.flash(`Enregistrement N° ${id} supprimé de ${t}.`); }
      ctx.redirect(back);
    }
    if (act === 'save') {
      let chg = {}; try { chg = JSON.parse(ctx.post('changes', '{}')); } catch {}
      if (!Object.keys(chg).length) { ctx.flash('Aucune modification à enregistrer.', 'err'); ctx.redirect(back); }
      try {
        const n = await C.tx(async () => { let n = 0;
          for (const [id, vals] of Object.entries(chg)) {
            const set = [], p = [];
            for (const [c, v0] of Object.entries(vals)) { const col = byName[c]; if (!col || c === pk) continue; let v = v0;
              if (col.secret) { if (v === '') continue; v = await bcrypt.hash(v, 10); } else v = T.convert(col, v);
              set.push(`${c} = ?`); p.push(v); }
            if (!set.length) continue; p.push(id);
            await C.q(`UPDATE ${t} SET ${set.join(', ')} WHERE ${pk}::text = ?`, p); n++;
          } return n; });
        ctx.flash(`${n} enregistrement(s) modifié(s) dans ${t}.`);
      } catch (err) { ctx.flash('Modification refusée : ' + err.message, 'err'); }
      ctx.redirect(back);
    }
    if (act === 'add') {
      const f = [], p = [];
      for (const [c, v0] of Object.entries(ctx.B.new || {})) { const col = byName[c]; if (!col || col.auto || v0 === '') continue; f.push(c); p.push(col.secret ? await bcrypt.hash(v0, 10) : T.convert(col, v0)); }
      if (!f.length) { ctx.flash('Remplissez au moins un champ de la nouvelle ligne.', 'err'); ctx.redirect(back); }
      try { const id = await C.val(`INSERT INTO ${t} (${f.join(',')}) VALUES (${f.map(() => '?').join(',')}) RETURNING ${pk}`, p); ctx.flash(`Nouvelle ligne N° ${id} ajoutée dans ${t}.`); }
      catch (err) { ctx.flash('Ajout refusé : ' + err.message, 'err'); }
      ctx.redirect(back);
    }
    ctx.redirect(back);
  }
  const par = 200, o = byName[o0] ? o0 : pk, d = d0 === 'desc' ? 'DESC' : 'ASC';
  const vis = cols.filter(c => !c.secret).map(c => c.name);
  const where = qs ? 'WHERE ' + vis.map(c => `${c}::text ILIKE ?`).join(' OR ') : '', wp = qs ? vis.map(() => '%' + qs + '%') : [];
  const total = Number(await C.val(`SELECT COUNT(*) FROM ${t} ${where}`, wp)), pages = Math.max(1, Math.ceil(total / par));
  const pg = Math.min(Math.max(1, Number(ctx.get('pg') || 1)), pages);
  const data = await C.rows(`SELECT ${cols.map(c => c.name).join(',')} FROM ${t} ${where} ORDER BY ${o} ${d} LIMIT ${par} OFFSET ${(pg - 1) * par}`, wp);
  const larg = Object.fromEntries(cols.map(c => [c.name, Math.max(6, Math.min(36, Math.max(c.name.length, ...data.map(r => String(r[c.name] ?? '').length)) + 1))]));
  const lien = x => `/gestion?p=fichiers&t=${t}&q=${encodeURIComponent(qs)}&o=${o}&d=${d.toLowerCase()}${x}`;
  const hid = `<input type="hidden" name="t" value="${t}"><input type="hidden" name="q" value="${e(qs)}"><input type="hidden" name="pg" value="${pg}"><input type="hidden" name="o" value="${e(o)}"><input type="hidden" name="d" value="${d.toLowerCase()}">`;
  return `<h1 class="page-title">${e(PRINC[t] || t)} <small style="font-weight:600;opacity:.8">(${t} · ${money(total)} lignes)</small></h1><div class="card">
<div class="xl-tools"><a class="btn" href="/gestion?p=fichiers">Retour</a>
  ${ecrire ? `<form method="post" class="row" data-confirm="delete" style="gap:.5rem;align-items:flex-end">${ctx.csrfField()}${hid}<input type="hidden" name="action" value="del">
    <div class="f" style="max-width:140px"><label>N°</label><input name="num" id="num" readonly placeholder="Choisir une ligne" style="font-weight:800;text-align:center"></div><button class="btn red" id="btdel" disabled>Supprimer</button></form>` : ''}
  <form method="get" action="/gestion" class="row" style="gap:.5rem;flex:1;align-items:flex-end"><input type="hidden" name="p" value="fichiers"><input type="hidden" name="t" value="${t}">
    <div class="f" style="flex:1;min-width:180px"><label>Rechercher dans toute la table</label><input name="q" value="${e(qs)}" placeholder="Texte, référence, agence…"></div><button class="btn ghost">Chercher</button></form>
  ${ecrire ? '<button type="button" class="btn orange" id="btadd">+ Ajouter une ligne</button><button type="button" class="btn green" id="btsave" disabled>Enregistrer les modifications (<span id="nch">0</span>)</button>' : '<span class="badge o" style="padding:.5rem .8rem">Consultation seulement</span>'}</div>
${ecrire ? `<form method="post" id="fadd" class="card" style="display:none;background:#FFF8E5">${ctx.csrfField()}${hid}<input type="hidden" name="action" value="add"><h2>Nouvelle ligne dans ${t}</h2>
  <div class="grid g4">${cols.filter(c => !c.auto).map(c => `<div class="f"><label>${e(c.name)} <small style="font-weight:500">(${e(c.type)})</small></label><input name="new[${e(c.name)}]" ${c.secret ? 'type="password"' : ''}></div>`).join('')}</div>
  <div class="actions"><button type="button" class="btn ghost" onclick="this.form.style.display='none'">Annuler</button><button class="btn green">Enregistrer la ligne</button></div></form>
<form method="post" id="fsave" data-confirm="modify">${ctx.csrfField()}${hid}<input type="hidden" name="action" value="save"><input type="hidden" name="changes" id="changes"></form>` : ''}
<div class="xl-wrap"><table class="xl" id="xl"><thead><tr>${cols.map(c => `<th class="${c.name === pk ? 'rn' : ''}"><a href="${e(lien('&o=' + c.name + '&d=' + (o === c.name && d === 'ASC' ? 'desc' : 'asc')))}" style="color:inherit;text-decoration:none">${e(c.name === pk ? 'N°' : c.name)}${o === c.name ? (d === 'ASC' ? ' ▲' : ' ▼') : ''}</a></th>`).join('')}</tr></thead><tbody>
${data.map(r => `<tr data-id="${e(r[pk])}">${cols.map(c => { const v = c.secret ? '' : String(r[c.name] ?? '');
  if (c.name === pk) return `<td class="rn">${e(r[c.name])}</td>`;
  if (!ecrire) return `<td class="ro">${c.secret ? '••••••' : e(v)}</td>`;
  return `<td><input data-c="${e(c.name)}" value="${e(v)}" data-o="${e(v)}" ${c.secret ? 'placeholder="(nouveau mot de passe)"' : ''} size="${larg[c.name]}" style="min-width:${(larg[c.name] * 0.62).toFixed(1)}em" aria-label="${e(c.name)}"></td>`; }).join('')}</tr>`).join('') || `<tr><td colspan="${cols.length}" class="ro" style="text-align:center;padding:2rem">Aucune ligne.</td></tr>`}</tbody></table></div>
<div class="row" style="justify-content:space-between;margin-top:.7rem"><span class="hint">Page ${pg} / ${pages} — ${par} lignes par page. Touchez le N° d'une ligne pour la sélectionner.</span>
<span>${pg > 1 ? `<a class="btn sm ghost" href="${e(lien('&pg=' + (pg - 1)))}">← Précédente</a>` : ''} ${pg < pages ? `<a class="btn sm ghost" href="${e(lien('&pg=' + (pg + 1)))}">Suivante →</a>` : ''}</span></div></div>
<script>
(function(){var tb=document.querySelector('#xl tbody'),num=document.getElementById('num'),del=document.getElementById('btdel'),chg={};
  function select(tr){tb.querySelectorAll('tr.sel').forEach(function(x){x.classList.remove('sel');});tr.classList.add('sel');if(num){num.value=tr.dataset.id;del.disabled=false;}}
  tb.addEventListener('click',function(e){var tr=e.target.closest('tr[data-id]');if(tr)select(tr);});
  var save=document.getElementById('btsave'),n=document.getElementById('nch');
  tb.addEventListener('input',function(e){var i=e.target;if(!i.dataset.c)return;var id=i.closest('tr').dataset.id,dirty=i.value!==i.dataset.o;i.classList.toggle('dirty',dirty);
    chg[id]=chg[id]||{};if(dirty)chg[id][i.dataset.c]=i.value;else delete chg[id][i.dataset.c];if(!Object.keys(chg[id]).length)delete chg[id];
    var c=0;Object.keys(chg).forEach(function(k){c+=Object.keys(chg[k]).length;});n.textContent=c;save.disabled=!c;});
  if(save)save.onclick=function(){document.getElementById('changes').value=JSON.stringify(chg);var f=document.getElementById('fsave');f.requestSubmit?f.requestSubmit():f.submit();};
  var add=document.getElementById('btadd');if(add)add.onclick=function(){var f=document.getElementById('fadd');f.style.display='block';f.querySelector('input:not([type=hidden])').focus();};})();
</script>`;
};
