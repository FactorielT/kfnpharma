'use strict';
/* Métadonnées des tables (éditeur, import / export Excel) */
const C = require('./core');
async function listTables() {
  return (await C.rows("SELECT table_name t FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> 'session' ORDER BY (table_name LIKE 'site\\_%'), table_name")).map(r => r.t);
}
async function columns(t) {
  const pk = (await C.rows(`SELECT k.column_name c FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage k ON k.constraint_name = tc.constraint_name AND k.table_name = tc.table_name
    WHERE tc.table_schema = 'public' AND tc.table_name = ? AND tc.constraint_type = 'PRIMARY KEY'`, [t])).map(r => r.c);
  return (await C.rows(`SELECT column_name AS name, data_type AS type, is_nullable = 'YES' AS nullable, column_default AS def FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ? ORDER BY ordinal_position`, [t]))
    .filter(c => c.type !== 'bytea')
    .map(c => ({ ...c, pk: pk.includes(c.name), auto: /nextval/.test(c.def || ''), secret: t === 'utilisateurs' && c.name === 'mot_de_passe', optional: c.nullable || c.def !== null }));
}
/** Convertit une valeur saisie / importée vers le type de la colonne */
function convert(col, v) {
  if (v instanceof Date) v = isNaN(v) ? null : (/time/.test(col.type) && !/timestamp/.test(col.type) ? v.toISOString().slice(11, 19) : (/timestamp/.test(col.type) ? v.toISOString().slice(0, 19).replace('T', ' ') : v.toISOString().slice(0, 10)));
  if (v && typeof v === 'object' && 'result' in v) v = v.result;          // formule Excel
  if (v && typeof v === 'object' && 'text' in v) v = v.text;              // lien hypertexte
  if (v && typeof v === 'object' && 'richText' in v) v = v.richText.map(x => x.text).join('');
  if (v === undefined || v === null) return null;
  if (typeof v === 'string') {
    v = v.trim(); if (v === '') return null;
    const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (m && /date|timestamp/.test(col.type)) v = `${m[3]}-${m[2]}-${m[1]}`;
    const l = v.toLowerCase();
    if (/int|numeric|double|real/.test(col.type)) { if (['vrai', 'true', 'oui'].includes(l)) return 1; if (['faux', 'false', 'non'].includes(l)) return 0; const n = Number(v.replace(/\s/g, '').replace(',', '.')); return isNaN(n) ? null : (/int/.test(col.type) ? Math.round(n) : n); }
  }
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number' && /int/.test(col.type)) return Math.round(v);
  if (typeof v === 'number' && /character|text/.test(col.type)) return String(v);
  return v;
}
const LIBELLES = { t_articles: 'Articles', t_famille: 'Familles', t_stock: 'Stocks des agences', t_client: 'Clients des agences', t_commande: 'Factures (commandes)', t_lignecmde: 'Lignes de factures',
  t_lignecmde_modif: 'Historique des modifications', t_paiement: 'Paiements du jour', t_paiement_sl: 'Paiements des crédits', t_appro: 'Approvisionnements', t_precommandeagence: 'Pré-commandes des agences',
  t_proforma: 'Pro-forma', t_inventaire: 'Inventaires', t_peremption: 'Retraits (péremption)', t_bonsorti_dp: 'Sorties du dépôt principal', t_compteagence: 'Versements des agences au siège',
  t_compteinterne: 'Comptes internes', t_depenses: 'Types de dépenses', t_sortieargent: 'Dépenses', t_fermercaisse: 'Fermetures de caisse', t_fournisseur: 'Fournisseurs', t_structure: 'Agences',
  t_versementsa: 'Versements clients', t_numero: 'Compteurs de numérotation', objectif: 'Objectifs', groupes: 'Groupes', utilisateurs: 'Utilisateurs', albumphoto: 'Album photo' };
const EXEMPLES = { refarticles: ['10ML', "Référence de l'article"], libarticles: ['SERINGUE 10 ML', "Libellé de l'article"], libellefa: ['SERINGUE', 'Famille (doit exister dans t_famille)'], familearticle: ['SERINGUE', 'Famille'],
  unitevaleur: ['Unité', 'Unité, Boîte, Kg, L, Mètre, Pot…'], structures: ['AGENCE SIEGE', "Nom exact de l'agence"], nom_structure: ['KORHOGO', "Nom de l'agence"], codecourt: ['KOR', 'Code court des numéros'],
  codearticles: ['AGENCE SIEGE10ML', "Nom de l'agence + référence, collés"], quantitestock: ['100', 'Quantité en stock'], quantitealerte: ['5', "Seuil d'alerte"], prixachat: ['1500', "Prix d'achat (FCFA)"],
  prixvente: ['2500', 'Prix de vente (FCFA)'], nomprenom: ['AFRICAN HEALTH', 'Nom du client — au siège : nom exact de l\'agence cliente'], client: ['AFRICAN HEALTH', 'Nom du client'], contact: ['0707070707', 'Téléphone'],
  quartier: ['Plateau', 'Localité'], numcmde: ['F261007-1YOP', 'N° de facture'], idcmde: ['F261007-1YOP', 'N° de facture / pré-commande'], numappro: ['AP2610071-SIE', "N° d'approvisionnement"],
  fournisseur: ['IMPORT DIRECT', 'Fournisseur'], qte: ['2', 'Quantité'], pv: ['2500', 'Prix unitaire'], mtapayer: ['5000', 'Montant à payer'], verse: ['5000', 'Montant versé'], reste: ['0', 'Reste à payer'],
  modepaiement: ['Espèce', 'Espèce, Mobile Money, Chèque, Virement'], statut: ['EN_ATTENTE', 'EN_ATTENTE, VALIDE_SIEGE, RECU_AGENCE, RETOURNE_SIEGE'], login: ['koffi.ama', 'Identifiant'],
  mot_de_passe: ['Motdepasse@2026', 'Mot de passe (chiffré à la 1re connexion)'], niveaudacces: ['RAG', 'SUP, ADM, RAG, GST, CAI, VEN, CON'], annee: ['2026', 'Année'], montant: ['10000000', 'Montant'] };
function exemple(c) {
  if (EXEMPLES[c.name]) return EXEMPLES[c.name];
  if (/date/.test(c.type)) return [C.dfr(C.today()), 'Date (JJ/MM/AAAA)'];
  if (/time/.test(c.type)) return ['08:30:00', 'Heure'];
  if (/int|numeric|double|real/.test(c.type)) return ['0', 'Nombre'];
  return ['', 'Texte'];
}
module.exports = { listTables, columns, convert, LIBELLES, exemple };
