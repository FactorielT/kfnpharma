'use strict';
/* =====================================================================
 *  Notifications dans l'application (workflow des pré-commandes)
 *   ✉ bleue  : nouvelle (à traiter)
 *   ✉ rouge  : en attente depuis trop longtemps (délai paramétrable)
 *   ✉ verte  : traitée
 *  Siège  : pré-commandes reçues des agences (à valider).
 *  Agence : réponses du siège (pré-commandes validées, à réceptionner).
 * ===================================================================== */
const C = require('./core');

async function delaiHeures() { return Number(await C.val("SELECT valeur FROM t_parametres WHERE cle = 'notif_delai_heures'")) || 48; }

/** Doit-on montrer des notifications à cet utilisateur ? */
function concerne(u) { return C.can(u, ['GST']) || C.isSiegeUser(u); }

async function liste(u, { jours = 15 } = {}) {
  if (!u || !concerne(u)) return { items: [], bleu: 0, rouge: 0, vert: 0, delai: 48 };
  const delai = await delaiHeures(), items = [];
  const ageH = d => (Date.now() - new Date(d).getTime()) / 3600000;
  if (C.isSiegeUser(u)) {
    // Siège : pré-commandes envoyées par les agences
    for (const r of await C.rows(`SELECT idcmde, structures, MIN(dateenreg) d, MIN(idprecommandeagence) id, COUNT(*) n, SUM(totalvente) t,
        BOOL_AND(statut <> 'EN_ATTENTE') traitee, MAX(datevalidation) dv, MAX(validepar) vp
      FROM t_precommandeagence GROUP BY idcmde, structures
      HAVING BOOL_OR(statut = 'EN_ATTENTE') OR MAX(datevalidation) >= CURRENT_DATE - ?::int
      ORDER BY MIN(idprecommandeagence) DESC LIMIT 200`, [jours])) {
      const recu = await C.val('SELECT MIN(datecreation) FROM t_notification WHERE reference = ? AND evenement = ?', [r.idcmde, 'PRECOMMANDE']) || r.d;
      const couleur = r.traitee ? 'vert' : (ageH(recu) > delai ? 'rouge' : 'bleu');
      items.push({ couleur, sens: 'recu', code: r.idcmde, agence: r.structures, date: r.d, lignes: Number(r.n), montant: Number(r.t),
        titre: r.traitee ? `Pré-commande ${r.idcmde} traitée` : `Nouvelle pré-commande de ${r.structures}`,
        texte: r.traitee ? `Validée le ${C.dfr(r.dv)}${r.vp ? ' par ' + r.vp : ''}` : `${r.n} article(s) — à valider`,
        lien: r.traitee ? `/gestion?p=point_appros&agence=${encodeURIComponent(r.structures)}` : `/gestion?p=appro_agences&agence=${encodeURIComponent(r.structures)}` });
    }
  }
  if (u.structures !== C.SIEGE || C.isSuper(u)) {
    // Agence : retours (réponses) du siège
    const ags = C.isSiegeUser(u) ? null : [u.structures];
    const w = ags ? 'AND structures = ?' : '';
    for (const r of await C.rows(`SELECT idcmde, structures, MAX(datevalidation) dv, MAX(validepar) vp, COUNT(*) n, SUM(qtevalidee*pv) t,
        BOOL_AND(statut IN ('RECU_AGENCE','RETOURNE_SIEGE')) traitee, MAX(datereception) dr
      FROM t_precommandeagence WHERE statut <> 'EN_ATTENTE' ${w} GROUP BY idcmde, structures
      HAVING BOOL_OR(statut = 'VALIDE_SIEGE') OR MAX(datereception) >= CURRENT_DATE - ?::int
      ORDER BY MAX(datevalidation) DESC NULLS LAST LIMIT 200`, ags ? [...ags, jours] : [jours])) {
      const couleur = r.traitee ? 'vert' : (ageH(r.dv) > delai ? 'rouge' : 'bleu');
      items.push({ couleur, sens: 'retour', code: r.idcmde, agence: r.structures, date: r.dv, lignes: Number(r.n), montant: Number(r.t),
        titre: r.traitee ? `Réception de ${r.idcmde} effectuée` : `Le siège a répondu à ${r.idcmde}`,
        texte: r.traitee ? `Réceptionnée le ${C.dfr(r.dr)}` : `Validée le ${C.dfr(r.dv)}${r.vp ? ' par ' + r.vp : ''} — à réceptionner`,
        lien: r.traitee ? `/gestion?p=point_appros&agence=${encodeURIComponent(r.structures)}` : `/gestion?p=reception_appro&agence=${encodeURIComponent(r.structures)}&aff=1` });
    }
  }
  const ordre = { rouge: 0, bleu: 1, vert: 2 };
  items.sort((a, b) => ordre[a.couleur] - ordre[b.couleur] || String(b.date).localeCompare(String(a.date)));
  return { items, delai, bleu: items.filter(i => i.couleur === 'bleu').length, rouge: items.filter(i => i.couleur === 'rouge').length, vert: items.filter(i => i.couleur === 'vert').length };
}

/** Icône d'enveloppe colorée */
function enveloppe(couleur, size = 22) {
  const c = { bleu: '#1F6FD1', rouge: '#D32F2F', vert: '#2E7D32' }[couleur] || '#777';
  return `<svg class="env env-${couleur}" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" style="fill:${c};stroke:none;flex:none"><path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm.8 2 8.2 6 8.2-6H3.8z"/></svg>`;
}
module.exports = { liste, enveloppe, concerne, delaiHeures };
