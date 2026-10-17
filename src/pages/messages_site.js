'use strict';
const C = require('../core'); const { e } = C;
module.exports = async ctx => {
  ctx.title = 'Messages du site web';
  if (ctx.req.method === 'POST') {
    if (ctx.post('del')) await C.q('DELETE FROM site_messages_contact WHERE id = ?', [Number(ctx.post('del'))]);
    if (ctx.post('lu')) await C.q('UPDATE site_messages_contact SET lu = 1 WHERE id = ?', [Number(ctx.post('lu'))]);
    if (ctx.post('tous')) await C.q('UPDATE site_messages_contact SET lu = 1');
    ctx.redirect('?p=messages_site');
  }
  const list = await C.rows('SELECT * FROM site_messages_contact ORDER BY lu, date_envoi DESC LIMIT 300');
  return `<h1 class="page-title">Messages reçus depuis le site internet</h1><div class="card">
<form method="post" class="actions" style="justify-content:flex-end;margin:0 0 .8rem">${ctx.csrfField()}<button class="btn ghost sm" data-confirm="modify" name="tous" value="1">Tout marquer comme lu</button></form>
${list.map(m => `<div class="card" style="${m.lu ? '' : 'border-left:5px solid var(--orange)'}"><div class="row" style="justify-content:space-between">
  <div><b>${e(m.nom)}</b> ${m.lu ? '' : '<span class="badge o">Nouveau</span>'}<br><a href="mailto:${e(m.email)}">${e(m.email)}</a>${m.telephone ? ` · <a href="tel:${e(m.telephone)}">${e(m.telephone)}</a>` : ''}</div>
  <small class="hint">${e(String(m.date_envoi).slice(0, 16).replace('T', ' '))}</small></div><p style="white-space:pre-wrap">${e(m.message)}</p>
  <form method="post" class="row">${ctx.csrfField()}<a class="btn sm green" href="mailto:${e(m.email)}?subject=${encodeURIComponent('Réponse KFN Pharma')}">Répondre</a>
  ${m.lu ? '' : `<button class="btn sm" data-confirm="modify" name="lu" value="${m.id}">Marquer comme lu</button>`}<button class="btn sm red" name="del" value="${m.id}" data-confirm="delete">Supprimer</button></form></div>`).join('') || '<p class="empty hint">Aucun message pour le moment.</p>'}</div>`;
};
