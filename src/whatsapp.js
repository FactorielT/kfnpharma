'use strict';
/* =====================================================================
 *  Notifications WhatsApp du workflow des pré-commandes
 *  Fournisseurs : WhatsApp Cloud API (Meta), Twilio, UltraMsg,
 *  Webhook HTTP (passerelle au choix, n8n, Make…), ou « aucun »
 *  (messages enregistrés dans le journal, envoi manuel par lien wa.me).
 * ===================================================================== */
const C = require('./core');
const { money, qty } = C;

/* ---------- Paramètres ---------- */
async function params() {
  return Object.fromEntries((await C.rows("SELECT cle, valeur FROM t_parametres WHERE cle LIKE 'wa\\_%'")).map(r => [r.cle, r.valeur ?? '']));
}
async function setParam(cle, valeur) {
  await C.q('INSERT INTO t_parametres (cle, valeur) VALUES (?, ?) ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur', [cle, valeur]);
}

/** Numéro au format international sans « + » (Côte d'Ivoire par défaut : 225) */
function normaliser(n, indicatif = '225') {
  let d = String(n || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1); else if (d.startsWith('00')) d = d.slice(2);
  else if (d.length === 10 && indicatif) d = indicatif + d;      // 07 08 56 36 57 -> 2250708563657
  return /^\d{8,15}$/.test(d) ? d : '';
}
function liste(s, indicatif) { return [...new Set(String(s || '').split(/[,;\n]/).map(x => normaliser(x, indicatif)).filter(Boolean))]; }

async function numerosSiege(p) { return liste(p.wa_siege_numeros, p.wa_indicatif || '225'); }
async function numerosAgence(ag, p) { return liste(await C.val('SELECT whatsapp FROM t_structure WHERE nom_structure = ?', [ag]), p.wa_indicatif || '225'); }

/* ---------- Fournisseurs ---------- */
const FOURNISSEURS = {
  aucun: 'Aucun envoi automatique (journal + envoi manuel par lien WhatsApp)',
  meta: 'WhatsApp Cloud API (Meta) — officiel',
  twilio: 'Twilio WhatsApp',
  ultramsg: 'UltraMsg (numéro WhatsApp existant)',
  webhook: 'Webhook HTTP (autre passerelle, n8n, Make…)',
};
async function http(url, opts) {
  const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(15000) });
  const txt = await r.text();
  if (!r.ok) throw new Error(`HTTP ${r.status} : ${txt.slice(0, 300)}`);
  return txt;
}
async function envoyer(p, to, texte) {
  switch (p.wa_fournisseur) {
    case 'meta': {
      if (!p.wa_meta_token || !p.wa_meta_phone_id) throw new Error('Jeton ou identifiant du numéro Meta manquant.');
      const body = p.wa_meta_modele
        ? { messaging_product: 'whatsapp', to, type: 'template', template: { name: p.wa_meta_modele, language: { code: p.wa_meta_langue || 'fr' },
            components: [{ type: 'body', parameters: [{ type: 'text', text: texte.replace(/\n+/g, ' | ').replace(/\s{4,}/g, '   ').slice(0, 1000) }] }] } }
        : { messaging_product: 'whatsapp', to, type: 'text', text: { preview_url: false, body: texte } };
      return http(`https://graph.facebook.com/v21.0/${encodeURIComponent(p.wa_meta_phone_id)}/messages`, {
        method: 'POST', headers: { Authorization: 'Bearer ' + p.wa_meta_token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }
    case 'twilio': {
      if (!p.wa_twilio_sid || !p.wa_twilio_token || !p.wa_twilio_from) throw new Error('Paramètres Twilio incomplets.');
      const from = 'whatsapp:+' + normaliser(p.wa_twilio_from, '');
      return http(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(p.wa_twilio_sid)}/Messages.json`, {
        method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(p.wa_twilio_sid + ':' + p.wa_twilio_token).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ From: from, To: 'whatsapp:+' + to, Body: texte }).toString() });
    }
    case 'ultramsg': {
      if (!p.wa_ultramsg_instance || !p.wa_ultramsg_token) throw new Error('Paramètres UltraMsg incomplets.');
      const t = await http(`https://api.ultramsg.com/${encodeURIComponent(p.wa_ultramsg_instance)}/messages/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: p.wa_ultramsg_token, to: '+' + to, body: texte }).toString() });
      if (/"error"/.test(t)) throw new Error(t.slice(0, 300));
      return t;
    }
    case 'webhook': {
      if (!/^https?:\/\//.test(p.wa_webhook_url || '')) throw new Error('Adresse du webhook manquante.');
      const h = { 'Content-Type': 'application/json' }; if (p.wa_webhook_secret) h.Authorization = 'Bearer ' + p.wa_webhook_secret;
      return http(p.wa_webhook_url, { method: 'POST', headers: h, body: JSON.stringify({ to, telephone: '+' + to, message: texte, source: 'KFN PHARMA' }) });
    }
  }
  return null;   // « aucun »
}

/** Enregistre puis envoie un message à plusieurs destinataires ; renvoie le bilan */
async function diffuser({ evenement, reference, agence, numeros, texte, user }) {
  const p = await params(), fourn = p.wa_fournisseur || 'aucun', bilan = { total: numeros.length, ok: 0, ko: 0, manuel: 0, erreurs: [] };
  await Promise.all(numeros.map(async to => {
    const id = await C.val(`INSERT INTO t_notification (evenement, reference, structures, destinataire, message, fournisseur, statut, utilisateur)
      VALUES (?,?,?,?,?,?,?,?) RETURNING idnotification`, [evenement, reference, agence, to, texte, fourn, fourn === 'aucun' ? 'MANUEL' : 'EN_COURS', user || '']);
    if (fourn === 'aucun') { bilan.manuel++; return; }
    try { await envoyer(p, to, texte); await C.q("UPDATE t_notification SET statut = 'ENVOYE', dateenvoi = NOW(), erreur = NULL WHERE idnotification = ?", [id]); bilan.ok++; }
    catch (err) { await C.q("UPDATE t_notification SET statut = 'ECHEC', erreur = ? WHERE idnotification = ?", [String(err.message).slice(0, 1000), id]); bilan.ko++; bilan.erreurs.push(err.message); }
  }));
  return bilan;
}
async function renvoyer(id) {
  const n = await C.row('SELECT * FROM t_notification WHERE idnotification = ?', [id]);
  if (!n) throw new Error('Notification introuvable.');
  const p = await params();
  if ((p.wa_fournisseur || 'aucun') === 'aucun') throw new Error("Aucun service d'envoi n'est configuré : utilisez le lien « Ouvrir dans WhatsApp ».");
  try { await envoyer(p, n.destinataire, n.message); await C.q("UPDATE t_notification SET statut = 'ENVOYE', fournisseur = ?, dateenvoi = NOW(), erreur = NULL WHERE idnotification = ?", [p.wa_fournisseur, id]); }
  catch (err) { await C.q("UPDATE t_notification SET statut = 'ECHEC', erreur = ? WHERE idnotification = ?", [String(err.message).slice(0, 1000), id]); throw err; }
}

/* ---------- Messages du workflow ---------- */
const lien = (p, page) => p.wa_app_url ? `\n${p.wa_app_url.replace(/\/$/, '')}/gestion?p=${page}` : '';
const actif = (p, k) => (p['wa_evt_' + k] ?? '1') === '1';
function resume(b) {
  if (!b || !b.total) return '';
  if (b.manuel) return ` Notification WhatsApp préparée (${b.manuel}) : envoi manuel depuis ADMIN → Notifications WhatsApp.`;
  return ` Notification WhatsApp : ${b.ok} envoyée(s)${b.ko ? `, ${b.ko} en échec (voir le journal)` : ''}.`;
}

/** 1. Une agence lance une pré-commande -> message au siège */
async function surPrecommande(code, user) {
  const p = await params(); if (!actif(p, 'precommande')) return null;
  const l = await C.rows('SELECT * FROM t_precommandeagence WHERE idcmde = ? ORDER BY idprecommandeagence', [code]); if (!l.length) return null;
  const tot = l.reduce((s, x) => s + Number(x.totalvente), 0);
  const texte = `📦 *KFN PHARMA — Nouvelle pré-commande*\nN° : ${code}\nAgence : *${l[0].structures}*\nDate : ${C.dfr(l[0].dateenreg)}\nDemandée par : ${l[0].utilisateur}\n\n*Articles demandés :*\n`
    + l.map(x => `• ${x.libarticles} × ${qty(x.qte)} ${x.unitevaleur || ''} — ${money(x.totalvente)} F`).join('\n')
    + `\n\n*Total : ${money(tot)} FCFA* (${l.length} ligne(s))\nÀ valider : Agence Siège → Approvisionnement des agences.` + lien(p, 'appro_agences');
  return diffuser({ evenement: 'PRECOMMANDE', reference: code, agence: l[0].structures, numeros: await numerosSiege(p), texte, user });
}

/** 2. Le siège valide -> message à l'agence */
async function surValidation(code, user) {
  const p = await params(); if (!actif(p, 'validation')) return null;
  const l = await C.rows('SELECT * FROM t_precommandeagence WHERE idcmde = ? ORDER BY idprecommandeagence', [code]); if (!l.length) return null;
  const tot = l.reduce((s, x) => s + Number(x.qtevalidee) * Number(x.pv), 0);
  const texte = `✅ *KFN PHARMA — Pré-commande validée par le siège*\nN° : ${code}\nAgence : *${l[0].structures}*\nValidée le ${C.dfr(l[0].datevalidation)} par ${l[0].validepar || user}\n\n*Quantités accordées :*\n`
    + l.map(x => `• ${x.libarticles} : demandé ${qty(x.qte)} → *accordé ${qty(x.qtevalidee)}*${Number(x.qtevalidee) < Number(x.qte) ? ' ⚠️' : ''}`).join('\n')
    + `\n\n*Montant accordé : ${money(tot)} FCFA*\nÀ réceptionner : Gestion de stocks → Approvisionnements (cochez les produits reçus ; une quantité qui ne convient pas peut être retournée au siège).` + lien(p, 'reception_appro');
  return diffuser({ evenement: 'VALIDATION', reference: code, agence: l[0].structures, numeros: await numerosAgence(l[0].structures, p), texte, user });
}

/** 3. L'agence accepte et/ou refuse (retour) des produits -> message au siège */
async function surReception(code, { acceptes = [], refuses = [], facture = null }, user) {
  const p = await params(); if (!actif(p, 'reception')) return null;
  const l = await C.rows('SELECT * FROM t_precommandeagence WHERE idcmde = ? ORDER BY idprecommandeagence', [code]); if (!l.length) return null;
  const ag = l[0].structures, attente = l.filter(x => x.statut === 'VALIDE_SIEGE');
  const A = l.filter(x => acceptes.includes(Number(x.idprecommandeagence)));
  // à l'acceptation, on rappelle aussi les produits déjà refusés de la même pré-commande
  const R = l.filter(x => refuses.includes(Number(x.idprecommandeagence)) || (acceptes.length && x.statut === 'RETOURNE_SIEGE'));
  const blocs = [];
  if (A.length) blocs.push(`✅ *Produits acceptés :*\n` + A.map(x => `• ${x.libarticles} × ${qty(x.qtevalidee)} — ${money(x.qtevalidee * x.pv)} F`).join('\n'));
  if (R.length) blocs.push(`↩️ *Produits refusés (retournés au stock du siège) :*\n` + R.map(x => `• ${x.libarticles} : ${qty(x.qtevalidee)} accordé(s) sur ${qty(x.qte)} demandé(s)`).join('\n'));
  let texte = `📥 *KFN PHARMA — Réception par l'agence ${ag}*\nN° pré-commande : ${code}\nLe ${C.dfr(C.today())} par ${user}\n\n` + blocs.join('\n\n');
  if (facture) texte += `\n\n🧾 Facture du siège à l'agence : *${facture.num}* — ${money(facture.montant)} FCFA`;
  texte += attente.length ? `\n\nReste à traiter par l'agence : ${attente.length} produit(s).` : `\n\nPré-commande entièrement traitée.`;
  texte += lien(p, 'point_appros');
  return diffuser({ evenement: R.length && !A.length ? 'RETOUR' : 'RECEPTION', reference: code, agence: ag, numeros: await numerosSiege(p), texte, user });
}

module.exports = { FOURNISSEURS, params, setParam, normaliser, liste, diffuser, renvoyer, resume, surPrecommande, surValidation, surReception };
