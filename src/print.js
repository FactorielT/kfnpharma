'use strict';
/* Impressions : factures, pro-forma, reçus, bons et factures d'approvisionnement */
const C = require('./core'); const W = require('./web'); const { e, money, qty } = C;
const NUM = new Set(['qte', 'qteappro', 'qtevalidee', 'pv', 'totalvente', 'remise', 'mtapayer', 'prixachat', 'totalachat', 'total']);
module.exports = async (req, res) => {
  const ctx = await W.buildCtx(req, res);
  const t = String(req.query.t || ''), n = String(req.query.n || ''), ags = ctx.agences;
  const deny = () => res.status(404).type('html').send('Document introuvable ou non autorisé.');
  let doc = '', agence = '', meta = {}, lines = [], cols = {}, totaux = {}, ticket = t === 'recu';
  try {
    if (t === 'facture') {
      const c = await C.row('SELECT * FROM t_commande WHERE numcmde = ?', [n]);
      // une agence peut voir les factures que le siège lui a adressées
      if (!c || !(ags.includes(c.structures) || (c.structures === C.SIEGE && ags.includes(c.nomprenom)))) return deny();
      agence = c.structures; doc = c.structures === C.SIEGE ? 'FACTURE KFN SIEGE' : 'FACTURE';
      meta = { 'N° facture': c.numcmde, Date: C.dfr(c.datecmde) + ' ' + String(c.heurecmde || '').slice(0, 5), [c.structures === C.SIEGE ? 'Agence cliente' : 'Client']: c.nomprenom, Vendeur: c.utilisateur, Origine: Number(c.livre) === 2 ? 'Approvisionnement ' + c.idclient : '' };
      lines = await C.rows('SELECT refarticles, libarticles, qte, unitevaleur, pv, totalvente, remise, mtapayer FROM t_lignecmde WHERE idcmde = ? ORDER BY idlignecmde', [n]);
      cols = { refarticles: 'Réf.', libarticles: 'Désignation', qte: 'Qté', unitevaleur: 'Unité', pv: 'P.U.', totalvente: 'Total', remise: 'Remise', mtapayer: 'Net' };
      totaux = { 'Montant total': c.mttotal, Remise: c.remise, 'Net à payer': c.mtapayer, 'Déjà versé': c.verse, 'Reste à payer': c.reste };
    } else if (t === 'proforma') {
      lines = await C.rows('SELECT refarticles, libarticles, qte, unitevaleur, pv, totalvente, remise, mtapayer, client, structures, dateenreg, utilisateur FROM t_proforma WHERE idcmde = ? ORDER BY idproforma', [n]);
      if (!lines.length || !ags.includes(lines[0].structures)) return deny();
      agence = lines[0].structures; doc = 'FACTURE PRO-FORMA';
      meta = { 'N° pro-forma': n, Date: C.dfr(lines[0].dateenreg), Client: lines[0].client, 'Établie par': lines[0].utilisateur, Validité: '30 jours' };
      cols = { refarticles: 'Réf.', libarticles: 'Désignation', qte: 'Qté', unitevaleur: 'Unité', pv: 'P.U.', totalvente: 'Total', remise: 'Remise', mtapayer: 'Net' };
      const s = k => lines.reduce((a, x) => a + Number(x[k]), 0);
      totaux = { 'Montant total': s('totalvente'), Remise: s('remise'), 'Net à payer': s('mtapayer') };
    } else if (t === 'recu') {
      const id = Number(n.slice(1));
      const p = n[0] === 'S' ? await C.row('SELECT * FROM t_paiement_sl WHERE idpaiementsl = ?', [id]) : await C.row('SELECT * FROM t_paiement WHERE idpaiement = ?', [id]);
      if (!p || !ags.includes(p.structures)) return deny();
      agence = p.structures; doc = 'REÇU DE PAIEMENT';
      meta = { 'N° reçu': n + '-' + String(p.datepaiement).slice(2, 4), Date: C.dfr(p.datepaiement) + ' ' + String(p.heure || '').slice(0, 5), [p.structures === C.SIEGE ? 'Agence cliente' : 'Client']: p.client, Facture: p.numcmde, 'Caissier(ère)': p.agent, Mode: p.modepaiement };
      lines = await C.rows('SELECT libarticles, qte, pv, mtapayer FROM t_lignecmde WHERE idcmde = ?', [p.numcmde]);
      cols = { libarticles: 'Désignation', qte: 'Qté', pv: 'P.U.', mtapayer: 'Net' };
      totaux = { 'Montant facture': p.montantcmde, 'Montant versé': p.verse, 'Monnaie rendue': p.rendu, 'Reste à payer': p.reste };
    } else if (t === 'appro') {
      lines = await C.rows('SELECT refarticles, libarticles, qteappro, unitevaleur, prixachat, totalachat, fournisseur, structures, dateappro, utilisateur, num_lot FROM t_appro WHERE numappro = ? ORDER BY idt_appro', [n]);
      if (!lines.length || !ags.includes(lines[0].structures)) return deny();
      agence = lines[0].structures; doc = "BON D'APPROVISIONNEMENT"; const f = lines[0];
      meta = { 'N° appro': n, Date: C.dfr(f.dateappro), Fournisseur: f.fournisseur, 'N° lot': f.num_lot, 'Saisi par': f.utilisateur };
      cols = { refarticles: 'Réf.', libarticles: 'Désignation', qteappro: 'Qté', unitevaleur: 'Unité', prixachat: 'Prix achat', totalachat: 'Total' };
      totaux = { 'Montant total': lines.reduce((a, x) => a + Number(x.totalachat), 0) };
    } else if (t === 'precmd') {
      lines = await C.rows('SELECT refarticles, libarticles, qte, qtevalidee, unitevaleur, pv, (qtevalidee*pv) AS total, structures, dateenreg, datevalidation, validepar, datereception, recupar FROM t_precommandeagence WHERE idcmde = ? ORDER BY idprecommandeagence', [n]);
      if (!lines.length || !ags.includes(lines[0].structures)) return deny();
      agence = C.SIEGE; doc = "FACTURE D'APPROVISIONNEMENT AGENCE"; const f = lines[0];
      meta = { 'N° pré-commande': n, 'Agence cliente': f.structures, 'Demandée le': C.dfr(f.dateenreg), 'Validée le': C.dfr(f.datevalidation) + (f.validepar ? ' par ' + f.validepar : ''), 'Reçue le': C.dfr(f.datereception) + (f.recupar ? ' par ' + f.recupar : '') };
      cols = { refarticles: 'Réf.', libarticles: 'Désignation', qte: 'Demandé', qtevalidee: 'Accordé', unitevaleur: 'Unité', pv: 'Prix', total: 'Total' };
      totaux = { 'Montant total': lines.reduce((a, x) => a + Number(x.total), 0) };
    } else return deny();
  } catch (err) { console.error(err); return deny(); }
  const S = await C.settings(), st = await C.row('SELECT * FROM t_structure WHERE nom_structure = ?', [agence]) || {};
  const tk = Object.keys(totaux), strong = t === 'facture' ? tk.indexOf('Net à payer') : tk.length - 1;
  res.type('html').send(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(doc + ' ' + n)}</title>
<style>body{font:13px/1.45 Arial,sans-serif;color:#111;margin:0;background:#eef2ef}.doc{background:#fff;max-width:${ticket ? '380px' : '820px'};margin:1rem auto;padding:${ticket ? '1rem' : '2rem 2.2rem'};box-shadow:0 10px 30px -18px rgba(0,0,0,.4)}
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;${ticket ? 'flex-direction:column;align-items:center;text-align:center' : ''}}.top img{height:${ticket ? '56px' : '70px'}}.soc{font-size:12px;color:#444;${ticket ? '' : 'text-align:right'}}
h1{font-size:${ticket ? '15px' : '19px'};text-align:center;margin:1.2rem 0;padding:.45rem;border-top:2px solid #2E7D32;border-bottom:2px solid #2E7D32;letter-spacing:.04em}
.meta{display:grid;grid-template-columns:${ticket ? '1fr' : '1fr 1fr'};gap:.25rem 1.5rem;margin-bottom:1rem}.meta b{display:inline-block;min-width:110px;color:#555;font-weight:600}
table{width:100%;border-collapse:collapse}th{background:#E07F16;color:#fff;text-align:left;padding:.4rem;font-size:12px}td{padding:.35rem .4rem;border-bottom:1px solid #ddd}.r{text-align:right;white-space:nowrap}
.tot{margin-left:auto;width:${ticket ? '100%' : '320px'};margin-top:1rem}.tot td{border:0;padding:.25rem .4rem}.tot tr.s td{font-weight:800;font-size:15px;border-top:2px solid #111}
.sign{display:${ticket ? 'none' : 'flex'};justify-content:space-between;margin-top:3rem}.foot{text-align:center;font-size:11px;color:#666;margin-top:2rem;border-top:1px solid #ddd;padding-top:.6rem}
.bar{text-align:center;margin:1rem}.bar button{font:700 14px Arial,sans-serif;padding:.7rem 1.4rem;border:0;border-radius:8px;background:#2E7D32;color:#fff;cursor:pointer;margin:.2rem}
@media print{body{background:#fff}.doc{box-shadow:none;margin:0;max-width:none;padding:0}.bar{display:none}th{-webkit-print-color-adjust:exact;print-color-adjust:exact}}@media (max-width:600px){.doc{margin:0;padding:1rem}.meta{grid-template-columns:1fr}.top{flex-direction:column}.soc{text-align:left}}</style></head><body>
<div class="bar"><button onclick="window.print()">Imprimer</button><button onclick="window.close()" style="background:#666">Fermer</button></div>
<div class="doc"><div class="top"><img src="/assets/img/logo.png" alt="KFN Pharma"><div class="soc"><b>KFN PHARMA SARL</b> — ${e(agence)}<br>${e(S.adresse || '')}<br>Tél : ${e(st.contact || S.telephone1 || '')} · ${e(S.email || '')}</div></div>
<h1>${e(doc)}</h1><div class="meta">${Object.entries(meta).filter(([, v]) => v && String(v).trim()).map(([k, v]) => `<div><b>${e(k)} :</b> ${e(v)}</div>`).join('')}</div>
<table><thead><tr>${Object.entries(cols).map(([k, l]) => `<th class="${NUM.has(k) ? 'r' : ''}">${e(l)}</th>`).join('')}</tr></thead><tbody>
${lines.map(l => `<tr>${Object.keys(cols).map(k => `<td class="${NUM.has(k) ? 'r' : ''}">${NUM.has(k) ? qty(l[k]) : e(l[k])}</td>`).join('')}</tr>`).join('')}</tbody></table>
<table class="tot">${tk.map((k, i) => `<tr${i === strong ? ' class="s"' : ''}><td>${e(k)}</td><td class="r">${money(totaux[k])} FCFA</td></tr>`).join('')}</table>
<div class="sign"><div>Signature ${agence === C.SIEGE ? 'agence cliente' : 'client'}</div><div>Cachet et signature KFN Pharma</div></div>
<div class="foot">Merci pour votre confiance — ${e(S.slogan || 'Le fournisseur N°1 du matériel médical')}<br>Imprimé le ${C.dfr(C.today())} à ${C.nowTime().slice(0, 5)} par ${e(ctx.uname())}</div></div></body></html>`);
};
