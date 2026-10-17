'use strict';
/* =====================================================================
 *  KFN PHARMA — noyau : PostgreSQL, utilitaires, droits, stock
 * ===================================================================== */
const { Pool, types } = require('pg');
const { AsyncLocalStorage } = require('node:async_hooks');
const fs = require('node:fs');
const path = require('node:path');
const cfg = require('./config');

/* ---------- Types PostgreSQL -> JavaScript ---------- */
types.setTypeParser(20, v => v === null ? null : Number(v));      // bigint
types.setTypeParser(1700, v => v === null ? null : Number(v));    // numeric (SUM…)
types.setTypeParser(1082, v => v);                                // date  -> 'AAAA-MM-JJ'
types.setTypeParser(1114, v => v);                                // timestamp -> texte

const pool = new Pool(cfg.db);
// Abidjan = GMT : les dates CURRENT_DATE / NOW() du serveur PostgreSQL (UTC) sont donc à l'heure locale.
const als = new AsyncLocalStorage();

/** Remplace les « ? » par $1, $2… (hors chaînes) */
function pgsql(sql) {
  let n = 0, out = '', q = false, dq = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (c === "'" && !dq) q = !q;
    else if (c === '"' && !q) dq = !dq;
    out += (!q && !dq && c === '?') ? '$' + (++n) : c;
  }
  return out;
}
function runner() { return als.getStore() || pool; }
async function q(sql, p = []) { return runner().query(pgsql(sql), p); }
async function rows(sql, p = []) { return (await q(sql, p)).rows; }
async function row(sql, p = []) { return (await q(sql, p)).rows[0] || null; }
async function val(sql, p = []) { const r = (await q(sql, p)).rows[0]; return r ? Object.values(r)[0] : null; }
/** Transaction : toutes les requêtes faites dans fn passent par la même connexion */
async function tx(fn) {
  if (als.getStore()) return fn();
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await als.run(c, fn);
    await c.query('COMMIT');
    return r;
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
}

/** Crée les tables au premier démarrage */
/* Mises à jour de structure appliquées à chaque démarrage (bases déjà installées) */
const MIGRATIONS = `
ALTER TABLE t_structure ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(120);
CREATE TABLE IF NOT EXISTS t_parametres (cle VARCHAR(60) PRIMARY KEY, valeur TEXT);
CREATE TABLE IF NOT EXISTS t_notification (idnotification BIGSERIAL PRIMARY KEY, datecreation TIMESTAMP DEFAULT NOW(), evenement VARCHAR(30), reference VARCHAR(60),
  structures VARCHAR(50), destinataire VARCHAR(30), message TEXT, fournisseur VARCHAR(20), statut VARCHAR(12) DEFAULT 'EN_COURS', erreur TEXT, dateenvoi TIMESTAMP, utilisateur VARCHAR(50));
CREATE INDEX IF NOT EXISTS idx_notif_date ON t_notification (datecreation);
INSERT INTO t_parametres (cle, valeur) VALUES ('wa_fournisseur','aucun'), ('wa_evt_precommande','1'), ('wa_evt_validation','1'), ('wa_evt_reception','1'), ('wa_siege_numeros','') ON CONFLICT (cle) DO NOTHING;`;
async function initDb() {
  const ok = await val("SELECT to_regclass('public.utilisateurs') IS NOT NULL");
  if (ok) { await pool.query(MIGRATIONS); return false; }
  const dir = path.join(__dirname, '..', 'database');
  await pool.query(fs.readFileSync(path.join(dir, 'schema.sql'), 'utf8'));
  await pool.query(fs.readFileSync(path.join(dir, 'seed.sql'), 'utf8'));
  return true;
}

/* ---------- Utilitaires ---------- */
const e = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sep = s => s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
function money(n) { n = Math.round(Number(n) || 0); return (n < 0 ? '-' : '') + sep(String(Math.abs(n))); }
function qty(n) {
  n = Number(n) || 0;
  if (Number.isInteger(n)) return money(n);
  const [a, b] = Math.abs(n).toFixed(2).split('.');
  return (n < 0 ? '-' : '') + sep(a) + ',' + b;
}
function num(v) { return Number(String(v ?? '').replace(/[\s\u202f\u00a0]/g, '').replace(',', '.')) || 0; }
function pad(n) { return String(n).padStart(2, '0'); }
function today() { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function nowTime() { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
function dfr(d) { if (!d) return ''; const s = String(d).slice(0, 10).split('-'); return s.length === 3 ? `${s[2]}/${s[1]}/${s[0]}` : String(d); }
const MOIS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
function moisFr(d) { return MOIS[d ? Number(String(d).slice(5, 7)) : new Date().getMonth() + 1]; }
function dateLongue() {
  const j = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'], d = new Date();
  return `${j[d.getDay()]} ${pad(d.getDate())} ${MOIS[d.getMonth() + 1]} ${d.getFullYear()}`;
}
function selOptions(items, sel = null, blank = true, blankLabel = '— Choisir —') {
  let h = blank ? `<option value="">${e(blankLabel)}</option>` : '';
  const list = Array.isArray(items) ? items.map(v => [v, v]) : Object.entries(items);
  for (const [v, l] of list) h += `<option value="${e(v)}"${String(v) === String(sel ?? '') ? ' selected' : ''}>${e(l)}</option>`;
  return h;
}

/* ---------- Profils et droits ---------- */
const SIEGE = cfg.siege;
const NIVEAUX = { SUP: 'Super Admin', ADM: 'Administrateur', RAG: "Responsable d'agence", GST: 'Gestionnaire stock', CAI: 'Caissier(ère)', VEN: 'Vendeur(se)', CON: 'Consultation' };
const ROLES_PROFIL = { RAG: ['RAG', 'CAI', 'VEN', 'CON', 'GST'], GST: ['GST'], CAI: ['CAI', 'CON'], VEN: ['VEN', 'CON'], CON: ['CON'] };
function level(u) { const l = u?.niveaudacces || ''; return l === 'GSS' ? 'GST' : l; }
const isSuper = u => level(u) === 'SUP';
const isAdmin = u => ['SUP', 'ADM'].includes(level(u));
const isSiegeUser = u => isSuper(u) || (u?.structures === SIEGE && ['ADM', 'GST', 'CON'].includes(level(u)));
function can(u, roles) { if (isAdmin(u)) return true; const m = ROLES_PROFIL[level(u)] || []; return (roles || []).some(r => m.includes(r)); }

/* ---------- Numérotation ---------- */
const COMPTEURS = ['numsortie', 'numappro', 'numprod', 'numfaprod', 'numcb', 'numcodarticle', 'numpreappro'];
async function nextCounter(col) {
  if (!COMPTEURS.includes(col)) throw new Error('Compteur inconnu');
  if (!(await val('SELECT COUNT(*) FROM t_numero'))) await q("INSERT INTO t_numero (numsortie,numappro,numprod,numfaprod,numcb,numcodarticle,numpreappro) VALUES ('0','0','0','0','0','0','0')");
  return Number(await val(`UPDATE t_numero SET ${col} = (COALESCE(NULLIF(${col},''),'0')::bigint + 1)::text
    WHERE idt_numero = (SELECT MIN(idt_numero) FROM t_numero) RETURNING ${col}`));
}
async function codeAgence(ag) {
  const c = await val('SELECT codecourt FROM t_structure WHERE nom_structure = ?', [ag]);
  return c || ag.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
}
/** Ex : PRA2610061-YOP, AP2610062-YOP, F261006-7001YOP */
async function newNumero(type, ag) {
  const c = await codeAgence(ag), d = today().slice(2).replace(/-/g, '');
  switch (type) {
    case 'precommande': return 'PRA' + d + await nextCounter('numpreappro') + '-' + c;
    case 'appro': return 'AP' + d + await nextCounter('numappro') + '-' + c;
    case 'facture': return 'F' + d + '-' + await nextCounter('numfaprod') + c;
    case 'proforma': return 'PF' + d + '-' + await nextCounter('numprod') + c;
  }
  throw new Error('Type de numéro inconnu');
}

/* ---------- Stock ---------- */
async function stockRow(ag, ref) { return row('SELECT * FROM t_stock WHERE structures = ? AND refarticles = ? LIMIT 1', [ag, ref]); }
/** Ajoute (delta > 0) ou retire (delta < 0) ; crée la ligne si besoin */
async function stockMove(ag, ref, delta, info = {}) {
  const s = await stockRow(ag, ref);
  if (s) { await q('UPDATE t_stock SET quantitestock = quantitestock + ? WHERE idt_stock = ?', [delta, s.idt_stock]); return; }
  const src = await stockRow(SIEGE, ref) || await row('SELECT libarticles, unitevaleur, libellefa AS familearticle, prixachat, prixvente FROM t_articles WHERE refarticles = ? LIMIT 1', [ref]) || {};
  const i = { ...src, ...info };
  await q(`INSERT INTO t_stock (refarticles, libarticles, quantitestock, quantitealerte, unitevaleur, structures, codearticles, prixachat, prixvente, familearticle, activer)
           VALUES (?,?,?,?,?,?,?,?,?,?,1)`, [ref, i.libarticles || ref, delta, i.quantitealerte ?? 5, i.unitevaleur || 'Unité', ag, ag + ref, i.prixachat || 0, i.prixvente || 0, i.familearticle || '']);
}

let settingsCache = null, settingsAt = 0;
async function settings() {
  if (!settingsCache || Date.now() - settingsAt > 60000) {
    try { settingsCache = Object.fromEntries((await rows('SELECT cle, valeur FROM site_parametres')).map(r => [r.cle, r.valeur])); } catch { settingsCache = {}; }
    settingsAt = Date.now();
  }
  return settingsCache;
}

module.exports = {
  pool, q, rows, row, val, tx, initDb, e, money, qty, num, pad, today, nowTime, dfr, MOIS, moisFr, dateLongue, selOptions,
  SIEGE, NIVEAUX, ROLES_PROFIL, level, isSuper, isAdmin, isSiegeUser, can, nextCounter, codeAgence, newNumero, stockRow, stockMove, settings,
};
