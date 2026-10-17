'use strict';
/* Configuration : variables d'environnement ou fichier .env à la racine du projet */
const fs = require('node:fs');
const path = require('node:path');
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const env = process.env;
process.env.TZ = env.TZ || 'Africa/Abidjan';
const ssl = /^(1|true|require)$/i.test(env.PGSSL || '') || /sslmode=require/.test(env.DATABASE_URL || '');
module.exports = {
  port: Number(env.PORT || 3000),
  db: env.DATABASE_URL
    ? { connectionString: env.DATABASE_URL, ssl: ssl ? { rejectUnauthorized: false } : false, max: Number(env.PGPOOL || 10) }
    : { host: env.PGHOST || 'localhost', port: Number(env.PGPORT || 5432), database: env.PGDATABASE || 'kfnpharma',
        user: env.PGUSER || 'postgres', password: env.PGPASSWORD || '', ssl: ssl ? { rejectUnauthorized: false } : false, max: Number(env.PGPOOL || 10) },
  sessionSecret: env.SESSION_SECRET || 'kfn-pharma-changez-moi',
  secureCookies: /^(1|true)$/i.test(env.SECURE_COOKIES || ''),
  trustProxy: /^(1|true)$/i.test(env.TRUST_PROXY || 'true'),
  siege: env.KFN_SIEGE || 'AGENCE SIEGE',
  devise: 'FCFA',
  appTitle: 'Système des ventes et de gestion de stocks',
};
