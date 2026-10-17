'use strict';
/* ADMIN : importation / exportation Excel de toutes les tables + modèles à remplir */
const ExcelJS = require('exceljs');
const C = require('../core'); const T = require('../tables'); const bcrypt = require('bcryptjs'); const { e, money } = C;
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
function styleHeader(ws) { const r = ws.getRow(1); r.font = { bold: true, color: { argb: 'FFFFFFFF' } }; r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE07F16' } }; ws.views = [{ state: 'frozen', ySplit: 1 }]; }
async function send(ctx, wb, name) {
  const buf = await wb.xlsx.writeBuffer();
  ctx.res.set({ 'Content-Type': XLSX_TYPE, 'Content-Disposition': `attachment; filename="${name}"` }).send(Buffer.from(buf));
  ctx.sent = true;
}
module.exports = async ctx => {
  const mode = ctx.get('a') === 'import' ? 'import' : 'export';
  ctx.title = mode === 'import' ? 'Importation des données (Excel)' : 'Exportation des données (Excel)';
  const tables = await T.listTables(), COLS = {};
  for (const t of tables) COLS[t] = await T.columns(t);

  /* ----- Export ----- */
  if (mode === 'export' && ctx.get('dl')) {
    let sel = ctx.req.query.t; sel = (Array.isArray(sel) ? sel : [sel]).filter(x => tables.includes(x));
    if (!sel.length) { ctx.flash('Cochez au moins une table à exporter.', 'err'); ctx.redirect('?p=excel&a=export'); }
    const wb = new ExcelJS.Workbook(); wb.creator = 'KFN PHARMA';
    for (const t of sel) {
      const cols = COLS[t].filter(c => !c.secret).map(c => c.name);
      const ws = wb.addWorksheet(t.slice(0, 31)); ws.addRow(cols); styleHeader(ws);
      for (const r of await C.rows(`SELECT ${cols.join(',')} FROM ${t} ORDER BY 1`)) ws.addRow(cols.map(c => r[c]));
      ws.columns.forEach((col, i) => { col.width = Math.max(10, Math.min(40, cols[i].length + 4)); });
    }
    return send(ctx, wb, `KFNPHARMA_${sel.length === 1 ? sel[0] : 'toutes_tables'}_${C.today()}.xlsx`);
  }
  /* ----- Modèles à remplir ----- */
  if (ctx.get('modele')) {
    const sel = ctx.get('modele') === 'TOUS' ? tables : tables.filter(x => x === ctx.get('modele'));
    if (!sel.length) { ctx.flash('Table inconnue.', 'err'); ctx.redirect('?p=excel&a=import'); }
    const wb = new ExcelJS.Workbook(), aide = wb.addWorksheet('LISEZ-MOI');
    aide.addRow(["MODÈLE D'IMPORT KFN PHARMA — " + (sel.length === 1 ? sel[0] : 'toutes les tables')]).font = { bold: true, size: 14 };
    ['1. Remplissez la feuille portant le nom de la table, une ligne par enregistrement, à partir de la ligne 2.', '2. Ne modifiez ni la 1re ligne (noms des colonnes) ni le nom des feuilles.',
      '3. Laissez vide une colonne inutile. Les identifiants (N°) sont attribués automatiquement.', '4. ADMIN → Importation des données (Excel) → choisissez ce fichier → Importer. Cette feuille LISEZ-MOI est ignorée.',
      "5. Au siège, les clients sont les agences : dans t_commande du siège, « nomprenom » = nom exact de l'agence.", ''].forEach(l => aide.addRow([l]));
    aide.addRow(['Table', 'Colonne', 'Exemple', 'Type', 'Description']).font = { bold: true };
    for (const t of sel) {
      const cols = COLS[t].filter(c => !c.auto);
      const ws = wb.addWorksheet(t.slice(0, 31)); ws.addRow(cols.map(c => c.name)); styleHeader(ws);
      ws.columns.forEach((col, i) => { col.width = Math.max(12, cols[i].name.length + 4); });
      for (const c of cols) { const [ex, d] = T.exemple(c); aide.addRow([t, c.name, ex, c.type, d + (c.optional ? '' : ' — obligatoire')]); }
    }
    aide.columns = [{ width: 22 }, { width: 24 }, { width: 22 }, { width: 22 }, { width: 70 }];
    return send(ctx, wb, `Modele_import_${sel.length === 1 ? sel[0] : 'toutes_tables'}.xlsx`);
  }
  /* ----- Import ----- */
  if (mode === 'import' && ctx.req.method === 'POST') {
    const file = ctx.files.find(f => f.fieldname === 'xlsx');
    if (!file) { ctx.flash('Choisissez un fichier Excel (.xlsx).', 'err'); ctx.redirect('?p=excel&a=import'); }
    const wb = new ExcelJS.Workbook();
    try { await wb.xlsx.load(file.buffer); } catch { ctx.flash("Ce fichier n'est pas un classeur Excel .xlsx valide.", 'err'); ctx.redirect('?p=excel&a=import'); }
    const cible = ctx.post('cible'), remplacer = ctx.post('mode') === 'remplacer', garderId = !!ctx.post('garder_id');
    const rapport = []; let total = 0, erreurs = 0;
    try {
      await C.tx(async () => {
        for (const ws of wb.worksheets) {
          const sheet = ws.name, t = (cible && tables.includes(cible)) ? cible : tables.find(x => x === sheet.trim().toLowerCase());
          if (!t) { rapport.push([sheet, '—', 0, 0, sheet.trim().toUpperCase() === 'LISEZ-MOI' ? 'Feuille d’aide du modèle (ignorée)' : 'Feuille ignorée : son nom ne correspond à aucune table']); continue; }
          const map = Object.fromEntries(COLS[t].map(c => [c.name.toLowerCase(), c]));
          const head = []; ws.getRow(1).eachCell({ includeEmpty: true }, (cell, i) => { head[i] = map[String(cell.value ?? '').trim().toLowerCase()] || null; });
          if (!head.some(Boolean)) { rapport.push([sheet, t, 0, 0, 'Aucune colonne reconnue en 1re ligne']); continue; }
          if (remplacer) await C.q(`DELETE FROM ${t}`);
          let ok = 0, ko = 0, msg = '';
          for (let r = 2; r <= ws.rowCount; r++) {
            const row = ws.getRow(r), f = [], p = [];
            for (let i = 1; i < head.length; i++) { const c = head[i]; if (!c || (c.auto && !garderId)) continue; let v = T.convert(c, row.getCell(i).value); if (c.secret && v) v = await bcrypt.hash(String(v), 10); f.push(c.name); p.push(v); }
            if (!f.length || p.every(v => v === null)) continue;
            try { await C.q('SAVEPOINT l'); await C.q(`INSERT INTO ${t} (${f.join(',')}) VALUES (${f.map(() => '?').join(',')})`, p); await C.q('RELEASE SAVEPOINT l'); ok++; }
            catch (err) { await C.q('ROLLBACK TO SAVEPOINT l'); ko++; msg = msg || err.message; }
          }
          if (garderId) { const pk = COLS[t].find(c => c.auto); if (pk) await C.q(`SELECT setval(pg_get_serial_sequence('${t}', '${pk.name}'), GREATEST(COALESCE((SELECT MAX(${pk.name}) FROM ${t}), 0), 1))`); }
          total += ok; erreurs += ko;
          rapport.push([sheet, t, ok, ko, ko ? 'Exemple de rejet : ' + msg.slice(0, 140) : 'OK']);
        }
      });
    } catch (err) { ctx.flash('Import annulé : ' + err.message, 'err'); ctx.redirect('?p=excel&a=import'); }
    ctx.req.session.rapport = rapport;
    ctx.flash(`Import terminé : ${total} ligne(s) importée(s)` + (erreurs ? `, ${erreurs} rejetée(s)` : '') + '.', erreurs ? 'info' : 'ok');
    ctx.redirect('?p=excel&a=import');
  }
  const cnt = {}; for (const t of tables) cnt[t] = await C.val(`SELECT COUNT(*) FROM ${t}`);
  const lib = t => T.LIBELLES[t] || (t.startsWith('site_') ? 'Site internet' : '');
  if (mode === 'export') return `<h1 class="page-title">Exportation des données en Excel</h1>
<form method="get" action="/gestion" class="card"><input type="hidden" name="p" value="excel"><input type="hidden" name="a" value="export"><input type="hidden" name="dl" value="1">
  <p class="hint" style="margin-top:0">Toutes les tables cochées sont exportées dans <b>un seul classeur Excel</b>, une feuille par table. Ce fichier peut être réimporté tel quel.</p>
  <div class="actions" style="justify-content:flex-start;margin:0 0 1rem"><button type="button" class="btn ghost sm" onclick="document.querySelectorAll('.tb').forEach(function(c){c.checked=true})">Tout cocher</button><button type="button" class="btn ghost sm" onclick="document.querySelectorAll('.tb').forEach(function(c){c.checked=false})">Tout décocher</button></div>
  <div class="tbl-wrap" style="max-height:none"><table class="tbl grey"><thead><tr><th class="c">Exporter</th><th>Table</th><th>Contenu</th><th class="r">Lignes</th><th></th></tr></thead><tbody>
  ${tables.map(t => `<tr><td class="c"><input type="checkbox" class="tb" name="t" value="${t}" checked></td><td><b>${t}</b></td><td>${e(lib(t))}</td><td class="r">${money(cnt[t])}</td><td class="r"><a class="btn sm ghost" href="/gestion?p=excel&a=export&dl=1&t=${t}">Cette table seule</a></td></tr>`).join('')}</tbody></table></div>
  <div class="actions"><button class="btn green">Exporter les tables cochées (.xlsx)</button></div></form>`;
  const rapport = ctx.req.session.rapport; delete ctx.req.session.rapport;
  return `<h1 class="page-title">Importation des données existantes (Excel)</h1>
${rapport ? `<div class="card"><h2>Rapport d'import</h2><div class="tbl-wrap"><table class="tbl grey"><thead><tr><th>Feuille Excel</th><th>Table</th><th class="r">Importées</th><th class="r">Rejetées</th><th>Détail</th></tr></thead><tbody>
  ${rapport.map(r => `<tr><td>${e(r[0])}</td><td>${e(r[1])}</td><td class="r">${r[2]}</td><td class="r ${r[3] ? 'neg' : ''}">${r[3]}</td><td>${e(r[4])}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
<div class="card"><h2>1. Télécharger le modèle de fichier à remplir</h2>
  <p class="hint" style="margin-top:0">Chaque modèle contient la feuille de la table avec les bons noms de colonnes, et une feuille <b>LISEZ-MOI</b> avec un exemple et l'explication de chaque colonne.</p>
  <div class="actions" style="justify-content:flex-start;margin:0 0 .8rem"><a class="btn green" href="/gestion?p=excel&a=import&modele=TOUS">Télécharger le modèle de toutes les tables (un seul fichier)</a></div>
  <div class="tbl-wrap" style="max-height:420px"><table class="tbl grey"><thead><tr><th>Table</th><th>Contenu</th><th>Colonnes à remplir</th><th></th></tr></thead><tbody>
  ${tables.map(t => { const cc = COLS[t].filter(c => !c.auto).map(c => c.name); return `<tr><td><b>${t}</b></td><td>${e(lib(t))}</td><td class="hint" style="white-space:normal;min-width:240px">${e(cc.slice(0, 8).join(', ') + (cc.length > 8 ? `… (${cc.length} colonnes)` : ''))}</td><td class="r"><a class="btn sm" href="/gestion?p=excel&a=import&modele=${t}" download>Télécharger le modèle</a></td></tr>`; }).join('')}</tbody></table></div></div>
<h1 class="page-title" style="background:var(--green-d)">2. Importer le fichier rempli</h1>
<form method="post" enctype="multipart/form-data" class="card">${ctx.csrfField()}
  <div class="grid g2"><div class="f span2"><label>Classeur Excel (.xlsx)</label><input type="file" name="xlsx" accept=".xlsx" required></div>
  <div class="f"><label>Table de destination</label><select name="cible"><option value="">Automatique : chaque feuille va dans la table du même nom</option>${tables.map(t => `<option value="${t}">${t}${lib(t) ? ' — ' + e(lib(t)) : ''}</option>`).join('')}</select></div>
  <div class="f"><label>Mode d'import</label><select name="mode"><option value="ajouter">Ajouter aux données existantes</option><option value="remplacer">Remplacer : vider la table puis importer</option></select></div></div>
  <label style="display:flex;gap:.5rem;align-items:center;margin-top:.8rem"><input type="checkbox" name="garder_id" value="1"> Conserver les identifiants (colonnes ID) du fichier — conseillé en mode « Remplacer » avec un fichier issu de l'export</label>
  <div class="actions"><button class="btn">Importer</button></div>
  <p class="hint">Les dates au format JJ/MM/AAAA ou en dates Excel sont converties ; Vrai/Faux et Oui/Non deviennent 1/0. Les lignes refusées sont listées dans le rapport ; en cas d'erreur grave, tout l'import est annulé.</p></form>`;
};
