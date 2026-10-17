'use strict';
/* ADMIN : Notifications WhatsApp (service d'envoi, numéros, test, journal) */
const C = require('../core'); const WA = require('../whatsapp'); const { e } = C;
const SECRETS = ['wa_meta_token', 'wa_twilio_token', 'wa_ultramsg_token', 'wa_webhook_secret'];
const CHAMPS = ['wa_fournisseur', 'wa_indicatif', 'wa_app_url', 'wa_meta_token', 'wa_meta_phone_id', 'wa_meta_modele', 'wa_meta_langue', 'wa_twilio_sid', 'wa_twilio_token', 'wa_twilio_from',
  'wa_ultramsg_instance', 'wa_ultramsg_token', 'wa_webhook_url', 'wa_webhook_secret'];
const STAT = { ENVOYE: ['Envoyé', ''], ECHEC: ['Échec', 'r'], EN_COURS: ['En cours', 'o'], MANUEL: ['À envoyer manuellement', 'o'] };
const EVT = { PRECOMMANDE: 'Pré-commande → siège', VALIDATION: 'Validation → agence', RECEPTION: 'Réception → siège', RETOUR: 'Produit refusé → siège', TEST: 'Test' };
module.exports = async ctx => {
  ctx.title = 'Notifications WhatsApp';
  if (ctx.req.method === 'POST') {
    const act = ctx.post('action');
    if (act === 'service') {
      for (const k of CHAMPS) { const v = ctx.post(k); if (SECRETS.includes(k) && !v) continue; await WA.setParam(k, v); }
      for (const k of ['precommande', 'validation', 'reception']) await WA.setParam('wa_evt_' + k, ctx.post('evt_' + k) ? '1' : '0');
      ctx.flash("Service d'envoi WhatsApp enregistré.");
    } else if (act === 'numeros') {
      const ind = (await WA.params()).wa_indicatif || '225', bad = [];
      const siege = WA.liste(ctx.post('siege'), ind); if (ctx.post('siege') && !siege.length) bad.push('siège');
      await WA.setParam('wa_siege_numeros', siege.join(', '));
      const nums = ctx.B.ag || {};
      for (const [k, v] of Object.entries(nums)) {
        const l = WA.liste(v, ind); if (String(v).trim() && !l.length) bad.push(k.slice(1));
        await C.q('UPDATE t_structure SET whatsapp = ? WHERE idt_structure = ?', [l.join(', '), Number(k.slice(1))]);
      }
      if (bad.length) ctx.flash('Numéro(s) non reconnu(s) ignoré(s) : ' + bad.join(', ') + '. Format attendu : 07 08 56 36 57 ou +225 07 08 56 36 57.', 'info');
      ctx.flash('Numéros WhatsApp enregistrés.');
    } else if (act === 'test') {
      const p = await WA.params(), to = WA.normaliser(ctx.post('numero'), p.wa_indicatif || '225');
      if (!to) ctx.flash('Saisissez un numéro WhatsApp valide.', 'err');
      else {
        const b = await WA.diffuser({ evenement: 'TEST', reference: 'TEST', agence: ctx.ustruct(), numeros: [to], user: ctx.uname(),
          texte: `🔔 *KFN PHARMA* — message de test\nLes notifications WhatsApp des pré-commandes fonctionnent.\nEnvoyé par ${ctx.uname()} le ${C.dfr(C.today())} à ${C.nowTime().slice(0, 5)}.` });
        if (b.ko) ctx.flash("Échec de l'envoi de test : " + b.erreurs[0], 'err');
        else if (b.manuel) ctx.flash("Aucun service d'envoi configuré : le message de test est dans le journal, avec un lien pour l'envoyer à la main.", 'info');
        else ctx.flash('Message de test envoyé au +' + to + '.');
      }
    } else if (act === 'renvoyer') {
      try { await WA.renvoyer(Number(ctx.post('id'))); ctx.flash('Notification renvoyée.'); } catch (err) { ctx.flash("Échec de l'envoi : " + err.message, 'err'); }
    }
    ctx.redirect('?p=whatsapp' + (ctx.post('statut') ? '&statut=' + encodeURIComponent(ctx.post('statut')) : ''));
  }
  const p = await WA.params(), f = p.wa_fournisseur || 'aucun';
  const ags = await C.rows('SELECT idt_structure, nom_structure, whatsapp, estsiege FROM t_structure ORDER BY estsiege DESC, nom_structure');
  const st = STAT[ctx.get('statut')] ? ctx.get('statut') : '';
  const journal = await C.rows(`SELECT * FROM t_notification ${st ? 'WHERE statut = ?' : ''} ORDER BY idnotification DESC LIMIT 150`, st ? [st] : []);
  const cnt = Object.fromEntries((await C.rows('SELECT statut, COUNT(*) n FROM t_notification GROUP BY statut')).map(r => [r.statut, Number(r.n)]));
  const inp = (k, label, ph = '', type = 'text') => `<div class="f"><label>${label}</label><input type="${type}" name="${k}" value="${SECRETS.includes(k) ? '' : e(p[k] || '')}" placeholder="${SECRETS.includes(k) && p[k] ? '•••••• (enregistré — laisser vide pour conserver)' : e(ph)}" autocomplete="off"></div>`;
  const chk = (k, l) => `<label style="display:flex;gap:.5rem;align-items:center;color:var(--ink);font-weight:600"><input type="checkbox" name="evt_${k}" value="1" ${(p['wa_evt_' + k] ?? '1') === '1' ? 'checked' : ''}> ${l}</label>`;
  return `<h1 class="page-title">Notifications WhatsApp — workflow des pré-commandes</h1>
<div class="card"><div class="kpis" style="margin:0">
  <div class="kpi"><small>Service d'envoi</small><b style="font-size:1rem">${e(WA.FOURNISSEURS[f])}</b></div>
  <div class="kpi"><small>Envoyées</small><b>${cnt.ENVOYE || 0}</b></div><div class="kpi r"><small>En échec</small><b>${cnt.ECHEC || 0}</b></div>
  <div class="kpi o"><small>À envoyer manuellement</small><b>${cnt.MANUEL || 0}</b></div></div>
  <p class="hint" style="margin-bottom:0">① Une agence lance une pré-commande → message au <b>siège</b> avec le détail de la commande. ② Le siège valide → message à l'<b>agence</b> avec les quantités accordées.
  ③ L'agence accepte et/ou retourne des produits → message au <b>siège</b> avec les produits acceptés et refusés.</p></div>

<h1 class="page-title" style="background:var(--green-d)">1. Numéros WhatsApp</h1>
<form method="post" class="card" data-confirm="modify">${ctx.csrfField()}<input type="hidden" name="action" value="numeros">
  <div class="f"><label>Numéros WhatsApp du SIÈGE (reçoivent les pré-commandes et les réceptions) — plusieurs numéros séparés par des virgules</label>
    <input name="siege" value="${e(p.wa_siege_numeros || '')}" placeholder="Ex : 07 08 56 36 57, 01 43 43 43 19"></div>
  <div class="tbl-wrap" style="margin-top:1rem;max-height:none"><table class="tbl grey"><thead><tr><th>Agence</th><th>Numéro(s) WhatsApp de l'agence (reçoivent les validations du siège)</th></tr></thead><tbody>
  ${ags.filter(a => !a.estsiege).map(a => `<tr><td><b>${e(a.nom_structure)}</b></td><td class="edit" style="background:#fff"><input name="ag[i${a.idt_structure}]" value="${e(a.whatsapp || '')}" placeholder="Ex : 05 05 44 44 44" inputmode="tel" style="text-align:left;font-weight:600"></td></tr>`).join('')}</tbody></table></div>
  <p class="hint">Numéros ivoiriens à 10 chiffres acceptés tels quels (l'indicatif ${e(p.wa_indicatif || '225')} est ajouté automatiquement), ou au format international +XXX…</p>
  <div class="actions"><button class="btn green">Enregistrer les numéros</button></div></form>

<h1 class="page-title" style="background:var(--green-d)">2. Service d'envoi</h1>
<form method="post" class="card" data-confirm="modify" autocomplete="off">${ctx.csrfField()}<input type="hidden" name="action" value="service">
  <div class="grid g3"><div class="f span2"><label>Service d'envoi des messages</label><select name="wa_fournisseur" id="fourn">${C.selOptions(WA.FOURNISSEURS, f, false)}</select></div>
    <div class="f"><label>Indicatif pays par défaut</label><input name="wa_indicatif" value="${e(p.wa_indicatif || '225')}" inputmode="numeric"></div>
    <div class="f span2"><label>Adresse de l'application (lien ajouté aux messages)</label><input name="wa_app_url" value="${e(p.wa_app_url || '')}" placeholder="Ex : https://kfnpharma.onrender.com"></div></div>
  <div class="grid g3 fz" data-f="meta">${inp('wa_meta_token', 'Jeton d\'accès permanent (System User)', '', 'password')}${inp('wa_meta_phone_id', 'Identifiant du numéro (Phone number ID)', 'Ex : 123456789012345')}
    ${inp('wa_meta_modele', 'Modèle de message approuvé (conseillé)', 'Ex : kfn_notification')}${inp('wa_meta_langue', 'Langue du modèle', 'fr')}
    <p class="hint span2" style="grid-column:1/-1">Meta n'autorise un message libre que si le destinataire vous a écrit dans les 24 h. Pour des notifications à tout moment, créez dans WhatsApp Manager un modèle « Utility » nommé par ex. <b>kfn_notification</b>, langue Français, corps : <code>KFN PHARMA : {{1}}</code>. Le message complet est placé dans {{1}}.</p></div>
  <div class="grid g3 fz" data-f="twilio">${inp('wa_twilio_sid', 'Account SID', 'ACxxxxxxxx')}${inp('wa_twilio_token', 'Auth Token', '', 'password')}${inp('wa_twilio_from', 'Numéro WhatsApp expéditeur Twilio', '+14155238886')}</div>
  <div class="grid g3 fz" data-f="ultramsg">${inp('wa_ultramsg_instance', 'Instance ID', 'instance12345')}${inp('wa_ultramsg_token', 'Token', '', 'password')}
    <p class="hint">UltraMsg envoie depuis un numéro WhatsApp existant (scan d'un QR code). Service non officiel de Meta : utilisez un numéro dédié.</p></div>
  <div class="grid g3 fz" data-f="webhook">${inp('wa_webhook_url', 'Adresse du webhook (POST JSON)', 'https://…')}${inp('wa_webhook_secret', 'Clé secrète (en-tête Authorization: Bearer)', '', 'password')}
    <p class="hint span2" style="overflow-wrap:anywhere">Corps envoyé : <code style="word-break:break-all">{"to":"2250708563657","telephone":"+2250708563657","message":"…","source":"KFN PHARMA"}</code></p></div>
  <div class="fz" data-f="aucun"><p class="hint">Sans service d'envoi, chaque message est enregistré dans le journal ci-dessous avec un bouton <b>Ouvrir dans WhatsApp</b> pour l'envoyer à la main.</p></div>
  <h2 style="margin-top:1rem">Messages à envoyer</h2><div class="grid g3">${chk('precommande', 'Nouvelle pré-commande → siège')}${chk('validation', 'Validation du siège → agence')}${chk('reception', 'Produits acceptés / refusés → siège')}</div>
  <div class="actions"><button class="btn green">Enregistrer le service</button></div></form>

<div class="card"><form method="post" class="row" data-kind="save">${ctx.csrfField()}<input type="hidden" name="action" value="test">
  <div class="f"><label>Envoyer un message de test au numéro</label><input name="numero" inputmode="tel" placeholder="Ex : 07 08 56 36 57" required></div><button class="btn">Envoyer le test</button></form></div>

<h1 class="page-title" style="background:var(--green-d)">3. Journal des notifications</h1>
<div class="card"><form method="get" action="/gestion" class="row" style="margin-bottom:.7rem"><input type="hidden" name="p" value="whatsapp">
  <div class="f" style="max-width:300px"><select name="statut" data-autosubmit><option value="">Tous les états</option>${Object.entries(STAT).map(([k, s]) => `<option value="${k}"${k === st ? ' selected' : ''}>${s[0]}</option>`).join('')}</select></div></form>
<div class="tbl-wrap"><table class="tbl grey"><thead><tr><th>Date</th><th>Événement</th><th>N° pré-commande</th><th>Agence</th><th>Destinataire</th><th>Message</th><th>État</th><th></th></tr></thead><tbody>
${journal.map(n => { const s = STAT[n.statut] || [n.statut, 'o']; return `<tr><td style="white-space:nowrap">${e(String(n.datecreation).slice(0, 16).replace('T', ' '))}</td><td>${e(EVT[n.evenement] || n.evenement)}</td><td>${e(n.reference)}</td><td>${e(n.structures)}</td><td>+${e(n.destinataire)}</td>
  <td style="white-space:pre-wrap;min-width:260px;max-width:420px;font-size:.8rem">${e(String(n.message).slice(0, 400))}${String(n.message).length > 400 ? '…' : ''}</td>
  <td><span class="badge ${s[1]}">${s[0]}</span>${n.erreur ? `<div class="hint" style="max-width:220px;white-space:normal">${e(String(n.erreur).slice(0, 160))}</div>` : ''}</td>
  <td style="white-space:nowrap"><a class="btn sm green" target="_blank" rel="noopener" href="https://wa.me/${e(n.destinataire)}?text=${encodeURIComponent(n.message)}">Ouvrir dans WhatsApp</a>
  ${n.statut === 'ECHEC' && f !== 'aucun' ? `<form method="post" style="display:inline" data-kind="save">${ctx.csrfField()}<input type="hidden" name="action" value="renvoyer"><input type="hidden" name="statut" value="${e(st)}"><button class="btn sm" name="id" value="${n.idnotification}">Renvoyer</button></form>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="8" class="empty">Aucune notification pour le moment.</td></tr>'}</tbody></table></div></div>
<script>(function(){var s=document.getElementById('fourn');function u(){document.querySelectorAll('.fz').forEach(function(x){x.style.display=x.dataset.f===s.value?'':'none';});}s.onchange=u;u();})();</script>`;
};
