'use strict';
/* Notifications des pré-commandes (enveloppes bleue / rouge / verte) */
const C = require('../core'); const N = require('../notifs'); const { e, money } = C;
const LIB = { bleu: 'Nouvelle — à traiter', rouge: 'En attente depuis longtemps', vert: 'Traitée' };
module.exports = async ctx => {
  ctx.title = 'Notifications';
  if (ctx.req.method === 'POST' && ctx.isAdmin()) {
    const h = Math.max(1, Math.min(720, Math.round(C.num(ctx.post('delai')))));
    await C.q("INSERT INTO t_parametres (cle, valeur) VALUES ('notif_delai_heures', ?) ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur", [String(h)]);
    ctx.flash(`Une notification passe au rouge après ${h} heure(s) sans traitement.`);
    ctx.redirect('?p=notifications');
  }
  const f = ['bleu', 'rouge', 'vert'].includes(ctx.get('c')) ? ctx.get('c') : '';
  const n = await N.liste(ctx.user, { jours: 30 }), items = f ? n.items.filter(i => i.couleur === f) : n.items;
  const tab = (c, l, nb) => `<a href="/gestion?p=notifications${c ? '&c=' + c : ''}" class="btn ${f === c ? '' : 'ghost'} sm" style="gap:.4rem">${c ? N.enveloppe(c, 18) : ''}${l} (${nb})</a>`;
  return `<h1 class="page-title">Notifications des pré-commandes</h1>
<div class="card">
  <div class="kpis" style="margin:0 0 .8rem">
    <a class="kpi b" href="/gestion?p=notifications&c=bleu" style="text-decoration:none;color:inherit;border-left-color:#1F6FD1"><small>${N.enveloppe('bleu', 18)} Nouvelles</small><b>${n.bleu}</b></a>
    <a class="kpi r" href="/gestion?p=notifications&c=rouge" style="text-decoration:none;color:inherit"><small>${N.enveloppe('rouge', 18)} En attente depuis plus de ${n.delai} h</small><b>${n.rouge}</b></a>
    <a class="kpi" href="/gestion?p=notifications&c=vert" style="text-decoration:none;color:inherit"><small>${N.enveloppe('vert', 18)} Traitées (30 derniers jours)</small><b>${n.vert}</b></a></div>
  <div class="row">${tab('', 'Toutes', n.items.length)}${tab('bleu', 'Nouvelles', n.bleu)}${tab('rouge', 'En attente longtemps', n.rouge)}${tab('vert', 'Traitées', n.vert)}</div>
  <p class="hint">${ctx.isSiege() ? 'Siège : pré-commandes envoyées par les agences.' : ''} ${ctx.ustruct() !== C.SIEGE || ctx.isSuper() ? 'Agence : réponses du siège (pré-commandes validées à réceptionner).' : ''}
  Les messages WhatsApp continuent d'être envoyés en parallèle (ADMIN → Notifications WhatsApp).</p></div>
<div class="card notif-list">
${items.map(i => `<a class="notif notif-${i.couleur}" href="${e(i.lien)}">${N.enveloppe(i.couleur, 34)}
  <div class="notif__txt"><b>${e(i.titre)}</b><span>${e(i.texte)}</span><small>${e(i.code)} · ${e(i.agence)} · ${C.dfr(i.date)} · ${i.lignes} ligne(s) · ${money(i.montant)} FCFA</small></div>
  <span class="badge ${i.couleur === 'rouge' ? 'r' : (i.couleur === 'bleu' ? 'o' : '')}">${LIB[i.couleur]}</span></a>`).join('') || '<p class="empty hint">Aucune notification.</p>'}
</div>
${ctx.isAdmin() ? `<div class="card"><form method="post" class="row" data-confirm="modify">${ctx.csrfField()}<div class="f" style="max-width:340px"><label>Passer l'enveloppe au rouge après (heures sans traitement)</label><input name="delai" inputmode="numeric" value="${n.delai}"></div><button class="btn">Enregistrer</button></form></div>` : ''}`;
};
