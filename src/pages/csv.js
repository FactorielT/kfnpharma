'use strict';
/* ADMIN : importation de fichiers CSV + modèles CSV */
const C = require('../core'); const T = require('../tables'); const { e } = C;
const TABLES = { t_articles: 'Articles', t_stock: 'Stocks', t_client: 'Clients', t_commande: 'Commandes', t_lignecmde: 'Lignes de commande', t_paiement: 'Paiements', t_paiement_sl: 'Paiements LS (crédits)', t_famille: 'Familles', t_appro: 'Approvisionnements' };
function parseCsv(text, sep) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; continue; }
    if (c === '"') q = true; else if (c === sep) { row.push(cur); cur = ''; } else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else if (c !== '\r') cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
module.exports = async ctx => {
  ctx.title = 'Importation de fichiers CSV';
  if (ctx.get('modele') && TABLES[ctx.get('modele')]) {
    const t = ctx.get('modele'), cols = (await T.columns(t)).filter(c => !c.auto).map(c => c.name);
    ctx.res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="Modele_import_${t}.csv"` }).send('\ufeff' + cols.join(';') + '\r\n');
    ctx.sent = true; return;
  }
  if (ctx.req.method === 'POST') {
    const t = ctx.post('table'), file = ctx.files.find(f => f.fieldname === 'csv');
    if (!TABLES[t] || !file) { ctx.flash('Choisissez la table et un fichier CSV.', 'err'); ctx.redirect('?p=csv'); }
    const text = file.buffer.toString('utf8').replace(/^\ufeff/, ''), first = text.split('\n')[0];
    const sep = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ',';
    const data = parseCsv(text, sep), cols = await T.columns(t), map = Object.fromEntries(cols.map(c => [c.name.toLowerCase(), c]));
    Object.assign(map, { 'livré': map.livre, 'payé': map.paye, 'caissefermée': map.caissefermee });
    const head = (data.shift() || []).map(h => map[h.trim().toLowerCase()] || null);
    if (!head.some(Boolean)) { ctx.flash(`Aucune colonne reconnue. La première ligne du CSV doit contenir les noms des colonnes de ${t}.`, 'err'); ctx.redirect('?p=csv'); }
    let ok = 0, ko = 0;
    await C.tx(async () => {
      if (ctx.post('vider')) await C.q(`DELETE FROM ${t}`);
      for (const r of data) {
        const f = [], p = [];
        head.forEach((c, i) => { if (!c || (c.auto && !ctx.post('garder_id'))) return; f.push(c.name); p.push(T.convert(c, r[i])); });
        if (!f.length || p.every(v => v === null)) continue;
        try { await C.q('SAVEPOINT l'); await C.q(`INSERT INTO ${t} (${f.join(',')}) VALUES (${f.map(() => '?').join(',')})`, p); await C.q('RELEASE SAVEPOINT l'); ok++; }
        catch { await C.q('ROLLBACK TO SAVEPOINT l'); ko++; }
      }
    });
    ctx.flash(`${TABLES[t]} : ${ok} ligne(s) importée(s)` + (ko ? `, ${ko} rejetée(s)` : '') + '.', ko ? 'info' : 'ok');
    ctx.redirect('?p=csv');
  }
  return `<h1 class="page-title">Importation de fichiers CSV</h1><div class="grid g2">
<form method="post" enctype="multipart/form-data" class="card">${ctx.csrfField()}<h2>Importer un fichier CSV</h2>
  <p class="hint">Séparateur « ; » ou « , ». La première ligne contient les noms des colonnes (ex. refarticles;libarticles;unitevaleur…). Les dates JJ/MM/AAAA sont converties.</p>
  <div class="f"><label>Table</label><select name="table" required>${C.selOptions(TABLES)}</select></div>
  <div class="f" style="margin-top:.7rem"><label>Fichier CSV</label><input type="file" name="csv" accept=".csv,text/csv" required></div>
  <label style="display:flex;gap:.5rem;align-items:center;margin-top:.7rem"><input type="checkbox" name="garder_id" value="1"> Conserver les identifiants d'origine</label>
  <label style="display:flex;gap:.5rem;align-items:center;margin-top:.4rem"><input type="checkbox" name="vider" value="1"> Vider la table avant l'import</label>
  <div class="actions"><button class="btn">Importer</button></div></form>
<div class="card"><h2>Modèles CSV à télécharger</h2><p class="hint" style="margin-top:0">Chaque modèle contient la ligne des noms de colonnes. Ouvrez-le dans Excel, remplissez une ligne par enregistrement, enregistrez en CSV puis importez-le.</p>
  <div class="grid g2">${Object.entries(TABLES).map(([k, l]) => `<a class="btn sm ghost" href="/gestion?p=csv&modele=${k}" download>Modèle : ${e(l)}</a>`).join('')}</div>
  <p class="hint" style="margin-top:1rem">Pour importer toutes les tables d'un coup, utilisez plutôt <a href="/gestion?p=excel&a=import">l'importation Excel</a>.</p></div></div>`;
};
