'use strict';
/* API JSON des fenêtres de choix */
const C = require('./core');
const W = require('./web');
const N = require('./notifs');
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
      case 'details': {
        // Détail d'une ligne d'état : facture, client, produit ou approvisionnement
        const t = String(req.query.type || ''), qv = k => String(req.query[k] || '');
        const D = c => `to_char(${c},'DD/MM/YYYY')`;
        const inAg = ag2 => ctx.agences.includes(ag2);
        if (t === 'facture') {
          const c = await C.row('SELECT * FROM t_commande WHERE numcmde = ?', [qv('num')]);
          if (!c || !(inAg(c.structures) || (c.structures === C.SIEGE && inAg(c.nomprenom)))) return out({ error: 'Facture introuvable' }, 404);
          return out({ titre: `Facture ${c.numcmde} — ${c.nomprenom}`, sousTitre: `${c.structures} · ${C.dfr(c.datecmde)} · vendeur ${c.utilisateur || '—'}${Number(c.livre) === 2 ? ' · facture d’approvisionnement' : ''}`,
            resume: [['Montant', c.mtapayer], ['Remise', c.remise], ['Versé', c.verse], ['Reste', c.reste]], imprimer: '/gestion/print?t=facture&n=' + encodeURIComponent(c.numcmde),
            sections: [
              { titre: 'Articles vendus', cols: ['Référence', 'Article', 'Qté', 'P.U.', 'Remise', 'Net'], num: [2, 3, 4, 5],
                rows: (await C.rows('SELECT refarticles, libarticles, qte, pv, remise, mtapayer FROM t_lignecmde WHERE idcmde = ? ORDER BY idlignecmde', [c.numcmde])).map(Object.values) },
              { titre: 'Paiements reçus', cols: ['Date', 'Heure', 'Versé', 'Reste après', 'Mode', 'Caissier(ère)'], num: [2, 3],
                rows: (await C.rows(`SELECT * FROM (SELECT datepaiement d, ${D('datepaiement')} dt, heure, verse, reste, modepaiement, agent FROM t_paiement WHERE numcmde = ?
                  UNION ALL SELECT datepaiement, ${D('datepaiement')}, heure, verse, reste, modepaiement, agent FROM t_paiement_sl WHERE numcmde = ?) x ORDER BY d, heure`, [c.numcmde, c.numcmde]))
                  .map(r => [r.dt, String(r.heure || '').slice(0, 5), r.verse, r.reste, r.modepaiement, r.agent]) }] });
        }
        if (t === 'client') {
          const a2 = ctx.agenceOk(qv('agence')), d1 = qv('d1') || '1900-01-01', d2 = qv('d2') || '2999-12-31';
          const rows = await C.rows(`SELECT numcmde, ${D('datecmde')} dt, qtetotal, mtapayer, verse, reste FROM t_commande WHERE structures = ? AND nomprenom = ? AND datecmde BETWEEN ? AND ? ${qv('credit') ? 'AND reste > 0' : ''} ORDER BY datecmde DESC`, [a2, qv('nom'), d1, d2]);
          const s = k => rows.reduce((x, r) => x + Number(r[k]), 0);
          return out({ titre: `${a2 === C.SIEGE ? 'Agence cliente' : 'Client'} : ${qv('nom')}`, sousTitre: `${a2}${qv('d1') ? ` · du ${C.dfr(d1)} au ${C.dfr(d2)}` : ''}${qv('credit') ? ' · factures non soldées' : ''}`,
            resume: [['Factures', rows.length], ['Montant', s('mtapayer')], ['Versé', s('verse')], ['Reste', s('reste')]],
            sections: [{ titre: 'Factures (touchez une ligne pour le détail)', cols: ['N° facture', 'Date', 'Qtés', 'Montant', 'Versé', 'Reste'], num: [2, 3, 4, 5], lien: { type: 'facture', col: 0, key: 'num' },
              rows: rows.map(r => [r.numcmde, r.dt, r.qtetotal, r.mtapayer, r.verse, r.reste]) }] });
        }
        if (t === 'produit') {
          const a2 = ctx.agenceOk(qv('agence')), d1 = qv('d1') || '1900-01-01', d2 = qv('d2') || '2999-12-31';
          const rows = await C.rows(`SELECT l.idcmde, ${D('l.dateenreg')} dt, c.nomprenom, l.qte, l.pv, l.mtapayer FROM t_lignecmde l LEFT JOIN t_commande c ON c.numcmde = l.idcmde
            WHERE l.structures = ? AND l.libarticles = ? AND l.dateenreg BETWEEN ? AND ? ORDER BY l.dateenreg DESC, l.idlignecmde DESC`, [a2, qv('lib'), d1, d2]);
          return out({ titre: `Ventes de « ${qv('lib')} »`, sousTitre: `${a2} · du ${C.dfr(d1)} au ${C.dfr(d2)}`,
            resume: [['Ventes', rows.length], ['Quantité', rows.reduce((x, r) => x + Number(r.qte), 0)], ['Montant', rows.reduce((x, r) => x + Number(r.mtapayer), 0)]],
            sections: [{ titre: 'Factures contenant cet article (touchez une ligne pour le détail)', cols: ['N° facture', 'Date', 'Client', 'Qté', 'P.U.', 'Net'], num: [3, 4, 5], lien: { type: 'facture', col: 0, key: 'num' },
              rows: rows.map(r => [r.idcmde, r.dt, r.nomprenom, r.qte, r.pv, r.mtapayer]) }] });
        }
        if (t === 'precmd') {
          const l = await C.rows('SELECT * FROM t_precommandeagence WHERE idcmde = ? ORDER BY idprecommandeagence', [qv('num')]);
          if (!l.length || !inAg(l[0].structures)) return out({ error: 'Pré-commande introuvable' }, 404);
          const ST = { EN_ATTENTE: 'En attente du siège', VALIDE_SIEGE: 'Validée — à réceptionner', RECU_AGENCE: 'Réceptionnée', RETOURNE_SIEGE: 'Retournée au siège' }, f = l[0];
          return out({ titre: `Pré-commande ${f.idcmde} — ${f.structures}`,
            sousTitre: `Demandée le ${C.dfr(f.dateenreg)} par ${f.utilisateur || '—'}` + (f.datevalidation ? ` · validée le ${C.dfr(f.datevalidation)} par ${f.validepar || '—'}` : '') + (f.datereception ? ` · réception le ${C.dfr(f.datereception)} par ${f.recupar || '—'}` : ''),
            resume: [['Articles', l.length], ['Qté demandée', l.reduce((a, x) => a + Number(x.qte), 0)], ['Qté accordée', l.reduce((a, x) => a + Number(x.qtevalidee), 0)], ['Montant accordé', l.reduce((a, x) => a + Number(x.qtevalidee) * Number(x.pv), 0)]],
            imprimer: '/gestion/print?t=' + (f.datevalidation ? 'validation' : 'fichepre') + '&n=' + encodeURIComponent(f.idcmde),
            sections: [{ titre: 'Produits', cols: ['Référence', 'Article', 'Demandé', 'Accordé', 'Prix', 'Montant accordé', 'État'], num: [2, 3, 4, 5],
              rows: l.map(x => [x.refarticles, x.libarticles, x.qte, x.qtevalidee, x.pv, Number(x.qtevalidee) * Number(x.pv), ST[x.statut] || x.statut]) }] });
        }
        if (t === 'appro') {
          const n2 = qv('num');
          let rows = await C.rows(`SELECT refarticles, libarticles, qteappro, prixachat, totalachat, structures, fournisseur, ${D('dateappro')} dt FROM t_appro WHERE numappro = ? ORDER BY idt_appro`, [n2]);
          if (!rows.length || !rows.some(r => inAg(r.structures))) return out({ error: 'Approvisionnement introuvable' }, 404);
          rows = rows.filter(r => inAg(r.structures));
          return out({ titre: `Approvisionnement ${n2}`, sousTitre: `${rows[0].structures} · ${rows[0].dt} · fournisseur ${rows[0].fournisseur}`,
            resume: [['Lignes', rows.length], ['Quantité', rows.reduce((x, r) => x + Number(r.qteappro), 0)], ['Montant', rows.reduce((x, r) => x + Number(r.totalachat), 0)]],
            imprimer: '/gestion/print?t=' + (n2.startsWith('PRA') ? 'precmd' : 'appro') + '&n=' + encodeURIComponent(n2),
            sections: [{ titre: 'Articles approvisionnés', cols: ['Référence', 'Article', 'Qté', 'Prix', 'Total'], num: [2, 3, 4], rows: rows.map(r => [r.refarticles, r.libarticles, r.qteappro, r.prixachat, r.totalachat]) }] });
        }
        return out({ error: 'Détail inconnu' }, 400);
      }
      case 'notifs': {
        const n = await N.liste(ctx.user);
        return out({ bleu: n.bleu, rouge: n.rouge, vert: n.vert, nouveaux: n.items.filter(i => i.couleur === 'bleu').slice(0, 5).map(i => ({ code: i.code, titre: i.titre, lien: i.lien })) });
      }
      case 'paiements':
        return out(await C.rows(`SELECT * FROM (
            SELECT 'P' || idpaiement AS id, numcmde AS num, client, verse, to_char(datepaiement,'DD/MM/YYYY') AS date, datepaiement AS d, modepaiement AS mode FROM t_paiement WHERE structures = ?
            UNION ALL SELECT 'S' || idpaiementsl, numcmde, client, verse, to_char(datepaiement,'DD/MM/YYYY'), datepaiement, modepaiement FROM t_paiement_sl WHERE structures = ?) x ORDER BY d DESC, id DESC LIMIT 300`, [ag, ag]));
    }
    out({ error: 'Action inconnue' }, 400);
  } catch (err) { console.error(err); out({ error: err.message }, 500); }
};
