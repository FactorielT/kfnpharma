'use strict';
/* API JSON des fenêtres de choix */
const C = require('./core');
const W = require('./web');
module.exports = async (req, res) => {
  const ctx = await W.buildCtx(req, res);
  const out = (d, code = 200) => res.status(code).json(d);
  const a = String(req.query.a || ''), ag = ctx.agenceOk(req.query.agence || (req.body || {}).agence);
  try {
    switch (a) {
      case 'stock': {
        const src = req.query.siege ? C.SIEGE : ag;
        return out(await C.rows(`SELECT refarticles AS ref, codearticles AS code, libarticles AS lib, unitevaleur AS unite, quantitestock AS qte, prixachat AS pa, prixvente AS pv, familearticle AS famille, quantitealerte AS alerte
          FROM t_stock WHERE structures = ? ORDER BY libarticles`, [src]));
      }
      case 'articles':
        return out(await C.rows('SELECT refarticles AS ref, libarticles AS lib, unitevaleur AS unite, libellefa AS famille, prixachat AS pa, prixvente AS pv FROM t_articles ORDER BY libarticles'));
      case 'precmd_attente':
        if (!ctx.isSiege()) return out({ error: 'Réservé au siège' }, 403);
        return out(await C.rows(`SELECT idcmde AS code, to_char(MIN(dateenreg),'DD/MM/YYYY') AS date, SUM(qte) AS qte, SUM(totalvente) AS total, COUNT(*) AS lignes
          FROM t_precommandeagence WHERE structures = ? AND statut = 'EN_ATTENTE' GROUP BY idcmde ORDER BY MIN(idprecommandeagence) DESC`, [ag]));
      case 'precmd_lignes': {
        if (!ctx.isSiege()) return out({ error: 'Réservé au siège' }, 403);
        const l = await C.rows(`SELECT p.idprecommandeagence AS id, p.refarticles AS ref, p.libarticles AS lib, p.qte AS demande, p.pv AS pa, p.unitevaleur AS unite, p.idcmde AS code, p.idcmde_ref AS idref, p.structures AS agence,
            COALESCE(s.quantitestock,0) AS dispo FROM t_precommandeagence p LEFT JOIN t_stock s ON s.structures = ? AND s.refarticles = p.refarticles
          WHERE p.idcmde = ? AND p.statut = 'EN_ATTENTE' ORDER BY p.idprecommandeagence`, [C.SIEGE, String(req.query.code || '')]);
        for (const r of l) { r.possible = Math.max(0, Math.min(Number(r.demande), Number(r.dispo))); r.total = r.possible * r.pa; }
        return out(l);
      }
      case 'clients':
        // Au siège, les clients sont les agences
        if (ag === C.SIEGE) return out((await C.rows('SELECT idt_structure AS id, nom_structure AS nom, contact, codecourt AS quartier FROM t_structure WHERE nom_structure <> ? ORDER BY nom_structure', [C.SIEGE])));
        return out(await C.rows('SELECT idt_client AS id, nomprenom AS nom, contact, quartier FROM t_client WHERE structures = ? ORDER BY nomprenom', [ag]));
      case 'add_client': {
        if (req.method !== 'POST') return out({ error: 'Méthode' }, 405);
        const b = req.body || {}, nom = String(b.nom || '').trim().toUpperCase(), a2 = ctx.agenceOk(b.agence);
        if (a2 === C.SIEGE) return out({ error: 'Au siège, les clients sont les agences : créez une agence dans ADMIN → Paramétrage des agences.' });
        if (!nom) return out({ error: 'Saisissez le nom du client.' });
        const id = await C.val('INSERT INTO t_client (nomprenom, contact, quartier, email, structures) VALUES (?,?,?,?,?) RETURNING idt_client', [nom, b.contact || '', b.quartier || '', b.email || '', a2]);
        return out({ id, nom });
      }
      case 'add_depense': {
        if (req.method !== 'POST') return out({ error: 'Méthode' }, 405);
        const d = String((req.body || {}).depense || '').trim();
        if (!d) return out({ error: 'Saisissez un libellé.' });
        await C.q('INSERT INTO t_depenses (depense, structures) VALUES (?,?)', [d, ag]);
        return out({ ok: 1, depense: d });
      }
      case 'facture_lignes': {
        const c = await C.row('SELECT * FROM t_commande WHERE numcmde = ?', [String(req.query.num || '')]);
        if (!c || !ctx.agences.includes(c.structures)) return out({ error: 'Facture introuvable' }, 404);
        return out({ cmd: c, lignes: await C.rows('SELECT refarticles AS ref, libarticles AS lib, qte, unitevaleur AS unite, pv, totalvente AS total, remise, mtapayer AS net, codearticles AS code FROM t_lignecmde WHERE idcmde = ? ORDER BY idlignecmde', [c.numcmde]) });
      }
      case 'proforma_lignes': {
        const l = await C.rows('SELECT refarticles AS ref, libarticles AS lib, qte, unitevaleur AS unite, pv, totalvente AS total, remise, mtapayer AS net, client, structures AS agence FROM t_proforma WHERE idcmde = ? ORDER BY idproforma', [String(req.query.num || '')]);
        if (l.length && !ctx.agences.includes(l[0].agence)) return out({ error: 'Accès refusé' }, 403);
        return out(l);
      }
      case 'factures_client': {
        const cl = String(req.query.client || '');
        return out(await C.rows(`SELECT * FROM (
            SELECT numcmde AS num, to_char(datecmde,'DD/MM/YYYY') AS date, mtapayer AS montant, verse, reste, 'Facture' AS type, datecmde AS d, livre FROM t_commande WHERE structures = ? AND nomprenom = ?
            UNION ALL SELECT idcmde, to_char(MIN(dateenreg),'DD/MM/YYYY'), SUM(mtapayer), 0, 0, 'Pro-forma', MIN(dateenreg), 0 FROM t_proforma WHERE structures = ? AND client = ? GROUP BY idcmde) x ORDER BY d DESC`, [ag, cl, ag, cl]));
      }
      case 'paiements':
        return out(await C.rows(`SELECT * FROM (
            SELECT 'P' || idpaiement AS id, numcmde AS num, client, verse, to_char(datepaiement,'DD/MM/YYYY') AS date, datepaiement AS d, modepaiement AS mode FROM t_paiement WHERE structures = ?
            UNION ALL SELECT 'S' || idpaiementsl, numcmde, client, verse, to_char(datepaiement,'DD/MM/YYYY'), datepaiement, modepaiement FROM t_paiement_sl WHERE structures = ?) x ORDER BY d DESC, id DESC LIMIT 300`, [ag, ag]));
    }
    out({ error: 'Action inconnue' }, 400);
  } catch (err) { console.error(err); out({ error: err.message }, 500); }
};
