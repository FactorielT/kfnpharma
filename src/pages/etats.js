'use strict';
/* Éditions des états : 12 bilans */
const C = require('../core'); const { e, money, qty } = C;
const DT = c => `to_char(${c},'DD/MM/YYYY')`;
const R = {
  ventes_jour: ['Bilans des ventes du jour', ['dates'], f => [`SELECT numcmde AS "N° commande", nomprenom AS "Client", ${DT('datecmde')} AS "Date cmde", qtetotal AS "Quantités total", mttotal AS "Montant total", remise AS "Remise", mtapayer AS "Montant après remise", verse AS "Payé", reste AS "Reste", utilisateur AS "Agent"
    FROM t_commande WHERE structures = ? AND datecmde BETWEEN ? AND ? ORDER BY datecmde DESC, idcommande DESC`, [f.ag, f.d1, f.d2]], 'facture'],
  credits: ['Bilans crédits', [], f => [`SELECT nomprenom AS "Nom client", SUM(mtapayer) AS "Montant commande", SUM(verse) AS "Montant payé", SUM(reste) AS "Reste"
    FROM t_commande WHERE structures = ? AND reste > 0 GROUP BY nomprenom ORDER BY SUM(reste) DESC`, [f.ag]]],
  credits_periode: ['Bilans sur période crédits', ['dates'], f => [`SELECT numcmde AS "N° commande", nomprenom AS "Nom client", mtapayer AS "Montant commande", verse AS "Payé", reste AS "Reste", ${DT('datecmde')} AS "Date cmde"
    FROM t_commande WHERE structures = ? AND reste > 0 AND datecmde BETWEEN ? AND ? ORDER BY datecmde`, [f.ag, f.d1, f.d2]], 'facture'],
  restes_client: ['Liste des impayés par client', ['client'], f => [`SELECT numcmde AS "N° commande", ${DT('datecmde')} AS "Date", mtapayer AS "Montant commande", verse AS "Montant payé", reste AS "Reste"
    FROM t_commande WHERE structures = ? AND nomprenom = ? AND reste > 0 ORDER BY datecmde`, [f.ag, f.cl]], 'facture'],
  produits: ['Bilans produits sur période', ['dates'], f => [`SELECT structures AS "Structure", libarticles AS "Libellé articles", SUM(qte) AS "Quantité", ROUND(SUM(mtapayer)/NULLIF(SUM(qte),0)) AS "Prix unitaire moyen", SUM(mtapayer) AS "Total"
    FROM t_lignecmde WHERE structures = ? AND dateenreg BETWEEN ? AND ? GROUP BY structures, refarticles, libarticles ORDER BY SUM(mtapayer) DESC`, [f.ag, f.d1, f.d2]]],
  clients_periode: ['Bilans clients sur période', ['client', 'dates'], f => [`SELECT numcmde AS "N° commande", mtapayer AS "Montant commande", verse AS "Payé", reste AS "Reste", ${DT('datecmde')} AS "Date"
    FROM t_commande WHERE structures = ? AND nomprenom = ? AND datecmde BETWEEN ? AND ? ORDER BY datecmde`, [f.ag, f.cl, f.d1, f.d2]], 'facture'],
  ca_client: ["Chiffres d'affaires par client", ['dates'], f => [`SELECT nomprenom AS "Nom prénom", COUNT(*) AS "Factures", SUM(mtapayer) AS "Chiffre d'affaires", SUM(verse) AS "Encaissé", SUM(reste) AS "Reste"
    FROM t_commande WHERE structures = ? AND datecmde BETWEEN ? AND ? GROUP BY nomprenom ORDER BY SUM(mtapayer) DESC`, [f.ag, f.d1, f.d2]]],
  appros: ['Bilans approvisionnements', ['dates'], f => [`SELECT ${DT('MIN(dateappro)')} AS "Date appro", numappro AS "N° appro", fournisseur AS "Fournisseur", SUM(qteappro) AS "Quantité appro", SUM(totalachat) AS "Montant"
    FROM t_appro WHERE structures = ? AND dateappro BETWEEN ? AND ? GROUP BY numappro, fournisseur ORDER BY MIN(dateappro) DESC`, [f.ag, f.d1, f.d2]], 'appro'],
  credits45: ['Liste des créanciers de plus de 45 jours', ['dates'], f => [`SELECT numcmde AS "N° commande", nomprenom AS "Client", mtapayer AS "Montant cmde", verse AS "Payé", reste AS "Reste", ${DT('datecmde')} AS "Date cmde", (CURRENT_DATE - datecmde) AS "Jours"
    FROM t_commande WHERE structures = ? AND reste > 0 AND datecmde <= CURRENT_DATE - 45 AND datecmde BETWEEN ? AND ? ORDER BY datecmde`, [f.ag, f.d1, f.d2]], 'facture'],
  paiements: ['Bilans des paiements par jour / période', ['dates'], f => [`SELECT * FROM (
      SELECT numcmde AS "N° commande", client AS "Client", montantcmde AS "Montant commande", verse AS "Versé jour", reste AS "Reste", ${DT('datepaiement')} AS "Date paiement", modepaiement AS "Mode", agent AS "Utilisateur", datepaiement AS _d FROM t_paiement WHERE structures = ? AND datepaiement BETWEEN ? AND ?
      UNION ALL SELECT numcmde, client, montantcmde, verse, reste, ${DT('datepaiement')}, modepaiement, agent, datepaiement FROM t_paiement_sl WHERE structures = ? AND datepaiement BETWEEN ? AND ?) x ORDER BY _d DESC`, [f.ag, f.d1, f.d2, f.ag, f.d1, f.d2]]],
  compte_client: ['Compte client', ['client'], f => [`SELECT numcmde AS "N° commande", mtapayer AS "Montant total commande", verse AS "Payé", reste AS "Reste", ${DT('datecmde')} AS "Date commande"
    FROM t_commande WHERE structures = ? AND nomprenom = ? ORDER BY datecmde DESC`, [f.ag, f.cl]], 'facture'],
  inventaires: ['Bilans des inventaires', ['dates'], f => [`SELECT ${DT('dateinventaire')} AS "Date", refarticles AS "Référence", libarticles AS "Libellé articles", quantiteinitial AS "Qté initiale", quantiteappro AS "Qté appro", quantitevendu AS "Qté vendue",
      quantitestockactuel AS "Stock logiciel", quantitephysique AS "Qté physique", quantiteecart AS "Écart", utilisateur AS "Utilisateur"
    FROM t_inventaire WHERE structures = ? AND dateinventaire BETWEEN ? AND ? ORDER BY dateinventaire DESC, libarticles`, [f.ag, f.d1, f.d2]]],
};
module.exports = async ctx => {
  let r = ctx.get('r', 'ventes_jour'); if (!R[r]) r = 'ventes_jour';
  const [title, filters, build, link] = R[r];
  ctx.title = title;
  const ag = ctx.agenceOk(ctx.get('agence'));
  const f = { ag, cl: ctx.get('client'), d1: ctx.get('d1') || (['ventes_jour', 'paiements'].includes(r) ? C.today() : C.today().slice(0, 8) + '01'), d2: ctx.get('d2') || C.today() };
  const needClient = filters.includes('client'), hasDates = filters.includes('dates');
  const clients = (await C.rows('SELECT DISTINCT nomprenom FROM t_commande WHERE structures = ? ORDER BY nomprenom', [ag])).map(x => x.nomprenom);
  const data = (needClient && !f.cl) ? [] : await C.rows(...build(f));
  const cols = data.length ? Object.keys(data[0]).filter(c => !c.startsWith('_')) : [];
  const numCols = new Set(cols.filter(c => typeof data[0][c] === 'number' && !/N°|Date|Référence/.test(c)));
  const sumCols = [...numCols].filter(c => !/Prix|Jours/.test(c));
  const total = c => data.reduce((s, x) => s + Number(x[c] || 0), 0);
  const lc = ag === C.SIEGE ? 'Agence cliente' : 'Client';
  const href = row => link === 'facture' && row['N° commande'] ? '/gestion/print?t=facture&n=' + encodeURIComponent(row['N° commande'])
    : (link === 'appro' ? '/gestion/print?t=' + (String(row['N° appro']).startsWith('PRA') ? 'precmd' : 'appro') + '&n=' + encodeURIComponent(row['N° appro']) : null);
  return `<h1 class="page-title">${e(title)}</h1>
<div class="card no-print"><form method="get" action="/gestion" class="row"><input type="hidden" name="p" value="etats"><input type="hidden" name="r" value="${e(r)}">
  <div class="f"><label>Agence</label><select name="agence">${ctx.agOptions(ag)}</select></div>
  ${needClient ? `<div class="f"><label>${lc}</label><select name="client">${C.selOptions(clients, f.cl, true, '— ' + lc + ' —')}</select></div>` : ''}
  ${hasDates ? `<div class="f"><label>Date début</label><input type="date" name="d1" value="${e(f.d1)}"></div><div class="f"><label>Date fin</label><input type="date" name="d2" value="${e(f.d2)}"></div>` : ''}
  <button class="btn" style="background:#0000C8">Afficher</button><button type="button" class="btn green" data-print>Imprimer</button><button type="button" class="btn ghost" data-export="#te" data-name="${e(r)}">Exporter (Excel)</button></form></div>
<div class="card"><p class="hint" style="margin-top:0">KFN PHARMA — <b>${e(ag)}</b>${needClient && f.cl ? ' — ' + lc.toLowerCase() + ' : <b>' + e(f.cl) + '</b>' : ''}${hasDates ? ' — du ' + C.dfr(f.d1) + ' au ' + C.dfr(f.d2) : ''} — édité le ${C.dfr(C.today())}</p>
  ${sumCols.length && data.length ? `<div class="kpis">${sumCols.slice(0, 4).map(c => `<div class="kpi"><small>${e(c)}</small><b>${money(total(c))}</b></div>`).join('')}</div>` : ''}
  <div class="tbl-wrap"><table class="tbl grey" id="te"><thead><tr>${cols.map(c => `<th class="${numCols.has(c) ? 'r' : ''}">${e(c)}</th>`).join('')}</tr></thead><tbody>
  ${data.map(row => { const h = href(row); return `<tr${h ? ` data-href="${e(h)}" title="Ouvrir le détail"` : ''}>${cols.map(c => `<td class="${numCols.has(c) ? 'r' : ''}${(c === 'Reste' || c === 'Écart') && row[c] > 0 ? ' neg' : ''}">${numCols.has(c) ? qty(row[c]) : e(row[c])}</td>`).join('')}</tr>`; }).join('')
    || `<tr><td class="empty" colspan="${Math.max(1, cols.length)}">${needClient && !f.cl ? 'Choisissez un ' + lc.toLowerCase() + ' puis cliquez sur « Afficher ».' : 'Aucune donnée sur cette sélection.'}</td></tr>`}</tbody>
  ${data.length && sumCols.length ? `<tfoot><tr>${cols.map((c, i) => `<td class="r">${sumCols.includes(c) ? money(total(c)) : (i === 0 ? 'Total (' + data.length + ')' : '')}</td>`).join('')}</tr></tfoot>` : ''}</table></div>
  ${link ? '<p class="hint no-print">Touchez une ligne pour ouvrir le détail imprimable.</p>' : ''}</div>`;
};
