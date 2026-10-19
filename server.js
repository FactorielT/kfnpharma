'use strict';
/* =====================================================================
 *  KFN PHARMA — Site internet + Application de gestion
 *  Node.js (Express) + PostgreSQL
 *  Démarrage : npm start   (crée les tables au premier lancement)
 * ===================================================================== */
const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const multer = require('multer');
const bcrypt = require('bcryptjs');
const cfg = require('./src/config');
const C = require('./src/core');
const W = require('./src/web');
const site = require('./src/site');
const { e } = C;

const app = express();
if (cfg.trustProxy) app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use((req, res, next) => { res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN' }); next(); });
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets'), { maxAge: '7d' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(express.json({ limit: '5mb' }));
app.use(session({
  store: new PgSession({ pool: C.pool, tableName: 'session', createTableIfMissing: true }),
  secret: cfg.sessionSecret, resave: false, saveUninitialized: false, name: 'kfn.sid',
  // Cookie de session du navigateur (sans durée) : fermer le navigateur déconnecte ; voir aussi l'inactivité ci-dessous
  cookie: { httpOnly: true, sameSite: 'lax', secure: cfg.secureCookies },
}));
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

/* ---------- Site internet ---------- */
app.get('/', wrap(site.home));
app.post('/contact', wrap(site.contact));
app.get('/recherche', wrap(site.recherche));
app.get('/sante', async (req, res) => { try { await C.val('SELECT 1'); res.json({ ok: true }); } catch (err) { res.status(500).json({ ok: false }); } });

/* ---------- Connexion ---------- */
function loginPage(err = '', login = '', info = '') {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Authentification — KFN Pharma</title><meta name="theme-color" content="#1B4D24"><link rel="icon" href="/assets/img/logo.png">
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Sora:wght@600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/css/app.css"></head><body>
<main class="login-page"><form class="login" method="post" action="/gestion/login" autocomplete="on">
  <img src="/assets/img/logo.png" alt="KFN Pharma"><h1>Authentification utilisateur</h1>
  <p class="sub">Utilisez vos paramètres de connexion pour vous identifier.</p>
  ${err ? `<div class="flash err">${e(err)}</div>` : ''}${info ? `<div class="flash info">${e(info)}</div>` : ''}
  <div class="f"><label for="login">Login</label><input id="login" name="login" required autofocus autocapitalize="none" value="${e(login)}"></div>
  <div class="f"><label for="mdp">Mot de passe</label><input id="mdp" type="password" name="mot_de_passe" required autocomplete="current-password"></div>
  <button class="btn orange block" type="submit">Connexion</button>
  <a class="back" href="/">← Retour au site internet</a>
</form></main></body></html>`;
}
/* L'écran de connexion s'affiche TOUJOURS : arriver ici (bouton « Espace Connexion » du site, déconnexion,
   session expirée) ferme la session éventuellement ouverte, et il faut s'authentifier pour entrer. */
const MSG_LOGIN = { expire: 'Votre session a expiré après une période d’inactivité. Veuillez vous authentifier de nouveau.', deconnecte: 'Vous êtes déconnecté(e). À bientôt !' };
app.get('/gestion/login', (req, res) => {
  const info = MSG_LOGIN[req.query.m] || '';
  const show = () => res.set('Cache-Control', 'no-store').type('html').send(loginPage('', '', info));
  if (req.session.user) return req.session.regenerate(() => show());
  show();
});
app.post('/gestion/login', wrap(async (req, res) => {
  const s = req.session, login = String(req.body.login || '').trim(), pass = String(req.body.mot_de_passe || '');
  s.tries = s.tries || 0;
  if (s.tries >= 8 && Date.now() - (s.tryAt || 0) < 300000) return res.type('html').send(loginPage('Trop de tentatives. Patientez 5 minutes puis réessayez.', login));
  try {
    const u = await C.row('SELECT * FROM utilisateurs WHERE login = ? LIMIT 1', [login]);
    let ok = false;
    if (u) {
      const st = String(u.mot_de_passe || '');
      if (/^\$2[aby]\$/.test(st)) ok = await bcrypt.compare(pass, st);
      else if (st && st === pass) { ok = true; await C.q('UPDATE utilisateurs SET mot_de_passe = ? WHERE idutilisateurs = ?', [await bcrypt.hash(pass, 10), u.idutilisateurs]); }
    }
    if (ok && !u.actif_life) return res.type('html').send(loginPage('Ce compte est désactivé. Contactez l’administrateur.', login));
    if (!ok) { s.tries++; s.tryAt = Date.now(); return res.type('html').send(loginPage('Login ou mot de passe incorrect.', login)); }
    delete u.mot_de_passe;
    req.session.regenerate(err => {
      if (err) return res.type('html').send(loginPage('Erreur de session, réessayez.'));
      req.session.user = u; req.session.lastSeen = Date.now();
      C.q('UPDATE utilisateurs SET derniere_cnx = NOW() WHERE idutilisateurs = ?', [u.idutilisateurs]).catch(() => {});
      req.session.save(() => res.redirect('/gestion'));
    });
  } catch (err) { console.error(err); res.type('html').send(loginPage('Connexion à la base impossible. Vérifiez la configuration.', login)); }
}));
app.get('/gestion/logout', (req, res) => req.session.destroy(() => res.redirect('/gestion/login?m=deconnecte')));
app.get('/gestion/guide', (req, res) => {
  if (!req.session.user) return res.redirect('/gestion/login');
  const pdf = path.join(__dirname, 'LISEZMOI_KFNPHARMA_NODE.pdf');
  if (fs.existsSync(pdf)) return res.type('pdf').sendFile(pdf);
  res.type('text/plain; charset=utf-8').send(fs.existsSync(path.join(__dirname, 'LISEZMOI.md')) ? fs.readFileSync(path.join(__dirname, 'LISEZMOI.md'), 'utf8') : 'Guide indisponible.');
});
app.get('/gestion/manifest.json', (req, res) => res.json({ name: 'KFN Pharma Gestion', short_name: 'KFN Gestion', start_url: '/gestion', display: 'standalone', background_color: '#EFF5F1', theme_color: '#E07F16', icons: [{ src: '/assets/img/logo.png', sizes: '243x121', type: 'image/png' }] }));

/* ---------- Application (connexion obligatoire) ---------- */
const IDLE_MS = Math.max(5, Number(process.env.SESSION_IDLE_MINUTES || 30)) * 60000;
function requireLogin(req, res, next) {
  res.set('Cache-Control', 'no-store');      // le bouton « Précédent » ne réaffiche pas l'application après déconnexion
  const s = req.session;
  if (s.user && s.lastSeen && Date.now() - s.lastSeen > IDLE_MS) {
    return s.destroy(() => (req.get('x-requested-with') || req.path.startsWith('/gestion/api')) ? res.status(401).json({ error: 'Session expirée' }) : res.redirect('/gestion/login?m=expire'));
  }
  // l'actualisation automatique des notifications ne compte pas comme une activité
  if (s.user) { if (req.query.a !== 'notifs') s.lastSeen = Date.now(); return next(); }
  if (req.get('x-requested-with') || req.path.startsWith('/gestion/api')) return res.status(401).json({ error: 'Session expirée' });
  res.redirect('/gestion/login');
}
function csrfOk(req) {
  const t = req.body?._csrf || req.get('x-csrf') || '';
  return req.session.csrf && t === req.session.csrf;
}
const OPERATEUR = ['facture', 'modif_facture', 'caisse_jour', 'caisse_impayes', 'depenses', 'fermeture_caisse'];
const PAGES = {};
for (const f of fs.readdirSync(path.join(__dirname, 'src', 'pages'))) if (f.endsWith('.js') && !f.startsWith('_')) PAGES[f.slice(0, -3)] = require('./src/pages/' + f);

async function gestion(req, res) {
  const ctx = await W.buildCtx(req, res);
  const page = String(req.query.p || 'accueil').replace(/[^a-z0-9_]/g, '') || 'accueil';
  const cur = page + (page === 'etats' ? '&r=' + (req.query.r || '') : '') + (page === 'excel' ? '&a=' + (req.query.a || '') : '') + (page === 'stocks' && req.query.prix ? '&prix=1' : '');
  let content;
  try {
    if (!PAGES[page]) { res.status(404); content = '<div class="flash err">Page introuvable.</div>'; }
    else if (!W.pageAllowed(ctx.user, page, page === 'etats' ? String(req.query.r || 'ventes_jour') : '')) { res.status(403); content = '<div class="flash err">Vous n’avez pas accès à cette rubrique. Contactez l’administrateur.</div>'; }
    else {
      if (req.method === 'POST' && !csrfOk(req)) return res.status(419).send('Session expirée. Rechargez la page et recommencez.');
      // Ventes et caisse : seuls les opérateurs configurés dans l'agence concernée peuvent agir
      const opAg = OPERATEUR.includes(page) ? ctx.agenceOk(ctx.post('agence') || ctx.get('agence')) : null;
      if (opAg && req.method === 'POST') ctx.requireOperateur(opAg, `?p=${page}&agence=${encodeURIComponent(opAg)}`);
      content = await PAGES[page](ctx);
      if (opAg && !ctx.estOperateur(opAg) && content) content = `<div class="flash err no-print" data-lecture>Consultation seulement : vous n'êtes pas configuré(e) dans l'agence « ${e(opAg)} ». Pour faire des ventes ou des opérations de caisse, l'opérateur doit être configuré dans l'agence concernée (ADMIN → Utilisateurs).</div>` + content
        + `<script>document.addEventListener('DOMContentLoaded',function(){document.querySelectorAll('form[method=post] button:not([type=button]), form[method=post] [data-act]').forEach(function(b){b.disabled=true;b.title='Réservé aux opérateurs de cette agence';});});</script>`;
      if (ctx.sent) return;
    }
  } catch (err) {
    if (err instanceof W.Redirect) return req.session.save(() => res.redirect(err.url.startsWith('?') ? '/gestion' + err.url : err.url));
    console.error(err);
    content = `<div class="flash err">Erreur : ${e(err.message)}</div>`;
  }
  res.type('html').send(await W.layout(ctx, page, cur, content || ''));
}
app.get('/gestion', requireLogin, wrap(gestion));
app.post('/gestion', requireLogin, upload.any(), wrap(gestion));
app.get('/gestion/api', requireLogin, wrap(require('./src/api')));
app.post('/gestion/api', requireLogin, (req, res, next) => csrfOk(req) ? next() : res.status(419).json({ error: 'Session expirée' }), wrap(require('./src/api')));
app.get('/gestion/print', requireLogin, wrap(require('./src/print')));

app.use((err, req, res, next) => { console.error(err); res.status(500).type('html').send('<!doctype html><meta charset="utf-8"><p>Une erreur est survenue. <a href="/">Retour</a></p>'); });
app.use((req, res) => res.status(404).type('html').send('<!doctype html><meta charset="utf-8"><p>Page introuvable. <a href="/">Retour au site</a></p>'));

process.on('unhandledRejection', err => console.error('Erreur non gérée :', err));
C.initDb().then(created => {
  if (created) console.log('Base de données initialisée (tables et données de départ créées).');
  const PORT = process.env.PORT || cfg.port || 3000;
app.listen(PORT, () => console.log(`KFN PHARMA en ligne sur le port ${PORT}`));
}).catch(err => { console.error('Connexion PostgreSQL impossible :', err.message); process.exit(1); });