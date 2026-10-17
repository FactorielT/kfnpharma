'use strict';
/* Enregistrement des factures et pro-forma (partagé par plusieurs écrans) */
const C = require('./core');
const { num } = C;

/** Au siège, le client d'une facture est obligatoirement une agence */
async function estAgenceCliente(nom) { return nom !== C.SIEGE && Number(await C.val('SELECT COUNT(*) FROM t_structure WHERE nom_structure = ?', [nom])) > 0; }

/**
 * Enregistre une facture : lignes + sortie de stock.
 * Vente du siège à une agence : le stock passe du siège à l'agence (entrée tracée dans t_appro).
 * opts.num / opts.old : réenregistrement d'une facture existante (modification).
 */
async function saveFacture(ctx, ag, client, lines, opts = {}) {
  const old = opts.old || null;
  const num_ = opts.num || await C.newNumero('facture', ag);
  const transfert = ag === C.SIEGE && await estAgenceCliente(client);
  const date = old ? String(old.datecmde).slice(0, 10) : C.today();
  let qt = 0, mt = 0, rem = 0;
  for (const l of lines) {
    const q = num(l.qte), pv = Math.round(num(l.pv)), r = Math.round(num(l.remise || 0));
    if (q <= 0) continue;
    const tot = Math.round(q * pv), s = await C.stockRow(ag, l.ref);
    await C.q(`INSERT INTO t_lignecmde (idcmde, refarticles, libarticles, qte, pv, totalvente, remise, mtapayer, dateenreg, mois, annee, unitevaleur, structures, codearticles)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [num_, l.ref, l.lib, q, pv, tot, r, tot - r, date, C.moisFr(date), date.slice(0, 4), l.unite || s?.unitevaleur || '', ag, ag + l.ref]);
    await C.stockMove(ag, l.ref, -q);
    if (transfert) {
      await C.stockMove(client, l.ref, q);
      await C.q(`INSERT INTO t_appro (refarticles, libarticles, qteappro, dateappro, utilisateur, unitevaleur, fournisseur, annees, mois, numappro, structures, codearticles, prixachat, totalachat)
        VALUES (?,?,?,?,?,?,'KFN SIEGE',?,?,?,?,?,?,?)`, [l.ref, l.lib, q, date, ctx.uname(), l.unite || '', date.slice(0, 4), C.moisFr(date), num_, client, client + l.ref, pv, tot - r]);
    }
    qt += q; mt += tot; rem += r;
  }
  const cl = ag === C.SIEGE ? null : await C.row('SELECT idt_client FROM t_client WHERE nomprenom = ? AND structures = ? LIMIT 1', [client, ag]);
  const apayer = mt - rem;
  if (old) {
    const verse = Number(old.verse || 0);
    await C.q('UPDATE t_commande SET nomprenom=?, idclient=?, qtetotal=?, mttotal=?, remise=?, mtapayer=?, reste=? WHERE idcommande=?', [client, String(cl?.idt_client ?? ''), qt, mt, rem, apayer, Math.max(0, apayer - verse), old.idcommande]);
  } else {
    await C.q(`INSERT INTO t_commande (numcmde, idclient, nomprenom, qtetotal, mttotal, remise, mtapayer, verse, reste, moiscmde, anneecmde, utilisateur, heurecmde, livre, datecmde, structures)
      VALUES (?,?,?,?,?,?,?,0,?,?,?,?,LOCALTIME,1,CURRENT_DATE,?)`, [num_, String(cl?.idt_client ?? ''), client, qt, mt, rem, apayer, apayer, C.moisFr(), String(new Date().getFullYear()), ctx.uname(), ag]);
  }
  return num_;
}

/** Annule les lignes d'une facture (remise en stock), avec historique */
async function annulerLignes(ctx, c) {
  const transfert = c.structures === C.SIEGE && await estAgenceCliente(c.nomprenom);
  for (const o of await C.rows('SELECT * FROM t_lignecmde WHERE idcmde = ?', [c.numcmde])) {
    await C.q(`INSERT INTO t_lignecmde_modif (idcmde, refarticles, libarticles, qte, pv, totalvente, remise, mtapayer, dateenreg, mois, annee, unitevaleur, structures, codearticles)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [o.idcmde, o.refarticles, o.libarticles, o.qte, o.pv, o.totalvente, o.remise, o.mtapayer, o.dateenreg, o.mois, o.annee, o.unitevaleur, o.structures, o.codearticles]);
    await C.stockMove(c.structures, o.refarticles, Number(o.qte));
    if (transfert) await C.stockMove(c.nomprenom, o.refarticles, -Number(o.qte));
  }
  if (transfert) await C.q("DELETE FROM t_appro WHERE numappro = ? AND fournisseur = 'KFN SIEGE'", [c.numcmde]);
  await C.q('DELETE FROM t_lignecmde WHERE idcmde = ?', [c.numcmde]);
}

async function saveProforma(ctx, ag, client, lines, num_ = null) {
  num_ = num_ || await C.newNumero('proforma', ag);
  for (const l of lines) {
    const q = num(l.qte); if (q <= 0) continue;
    const pv = Math.round(num(l.pv)), r = Math.round(num(l.remise || 0)), tot = Math.round(q * pv);
    await C.q(`INSERT INTO t_proforma (idcmde, refarticles, libarticles, qte, pv, totalvente, remise, mtapayer, dateenreg, mois, annee, utilisateur, unitevaleur, structures, codearticles, accepter, idcmde_ref, client)
      VALUES (?,?,?,?,?,?,?,?,CURRENT_DATE,?,?,?,?,?,?,0,?,?)`, [num_, l.ref, l.lib, q, pv, tot, r, tot - r, C.moisFr(), String(new Date().getFullYear()), ctx.uname(), l.unite || '', ag, ag + l.ref, num_ + ' ' + ag + l.ref, client]);
  }
  return num_;
}

/**
 * Facture du siège à une agence pour un approvisionnement réceptionné.
 * Le stock a déjà été transféré par l'appro : aucune sortie de stock ici (livre = 2).
 */
async function factureAppro(ctx, agence, code, lignes) {
  const n = await C.newNumero('facture', C.SIEGE);
  let qt = 0, mt = 0;
  for (const p of lignes) {
    const q = Number(p.qtevalidee), tot = Math.round(q * Number(p.pv));
    if (q <= 0) continue;
    await C.q(`INSERT INTO t_lignecmde (idcmde, refarticles, libarticles, qte, pv, totalvente, remise, mtapayer, dateenreg, mois, annee, unitevaleur, structures, codearticles)
      VALUES (?,?,?,?,?,?,0,?,CURRENT_DATE,?,?,?,?,?)`, [n, p.refarticles, p.libarticles, q, p.pv, tot, tot, C.moisFr(), String(new Date().getFullYear()), p.unitevaleur, C.SIEGE, C.SIEGE + p.refarticles]);
    qt += q; mt += tot;
  }
  if (!mt) return null;
  await C.q(`INSERT INTO t_commande (numcmde, idclient, nomprenom, qtetotal, mttotal, remise, mtapayer, verse, reste, moiscmde, anneecmde, utilisateur, heurecmde, livre, datecmde, structures)
    VALUES (?,?,?,?,?,0,?,0,?,?,?,?,LOCALTIME,2,CURRENT_DATE,?)`, [n, code, agence, qt, mt, mt, mt, C.moisFr(), String(new Date().getFullYear()), ctx.uname(), C.SIEGE]);
  return n;
}

module.exports = { estAgenceCliente, saveFacture, annulerLignes, saveProforma, factureAppro };
