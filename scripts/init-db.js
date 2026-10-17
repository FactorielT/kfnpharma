'use strict';
/* Initialise la base PostgreSQL.
 *   npm run db:init          crée les tables si elles n'existent pas
 *   npm run db:reset         EFFACE tout et recrée les tables + données de départ */
const fs = require('node:fs'); const path = require('node:path');
const C = require('../src/core');
(async () => {
  try {
    if (process.argv.includes('--reset')) {
      await C.pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
      console.log('Base vidée.');
    }
    const created = await C.initDb();
    console.log(created ? 'Tables et données de départ créées.' : 'Les tables existent déjà : rien à faire (utilisez npm run db:reset pour tout recréer).');
  } catch (e) { console.error('Erreur :', e.message); process.exitCode = 1; }
  await C.pool.end();
})();
