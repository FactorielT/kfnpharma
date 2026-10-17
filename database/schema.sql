-- =====================================================================
--  KFN PHARMA — Base de données PostgreSQL (site internet + application)
--  Compatible PostgreSQL 12 à 17
--  Les noms de tables et colonnes de l'analyse WinDev sont conservés
--  (en minuscules : PostgreSQL ne distingue pas la casse sans guillemets).
-- =====================================================================
SET client_encoding = 'UTF8';

-- =====================================================================
--  PARTIE 1 : SITE INTERNET
-- =====================================================================

DROP TABLE IF EXISTS site_parametres CASCADE;
CREATE TABLE site_parametres (
  cle      VARCHAR(60)  NOT NULL PRIMARY KEY,
  valeur   TEXT,
  libelle  VARCHAR(120)
);

DROP TABLE IF EXISTS site_slides CASCADE;
CREATE TABLE site_slides (
  id           SERIAL PRIMARY KEY,
  titre        VARCHAR(150) NOT NULL,
  sous_titre   VARCHAR(255),
  image        VARCHAR(255) NOT NULL,
  bouton_texte VARCHAR(60),
  bouton_lien  VARCHAR(255),
  ordre        INT DEFAULT 0,
  actif        SMALLINT DEFAULT 1
);

DROP TABLE IF EXISTS site_services CASCADE;
CREATE TABLE site_services (
  id          SERIAL PRIMARY KEY,
  titre       VARCHAR(120) NOT NULL,
  resume      VARCHAR(255),
  description TEXT,
  icone       VARCHAR(40) DEFAULT 'entretien',
  ordre       INT DEFAULT 0,
  actif       SMALLINT DEFAULT 1
);

DROP TABLE IF EXISTS site_activites CASCADE;
CREATE TABLE site_activites (
  id          SERIAL PRIMARY KEY,
  titre       VARCHAR(120) NOT NULL,
  description TEXT,
  image       VARCHAR(255),
  ordre       INT DEFAULT 0,
  actif       SMALLINT DEFAULT 1
);

DROP TABLE IF EXISTS site_competences CASCADE;
CREATE TABLE site_competences (
  id          SERIAL PRIMARY KEY,
  libelle     VARCHAR(80) NOT NULL,
  pourcentage SMALLINT DEFAULT 100,
  ordre       INT DEFAULT 0
);

DROP TABLE IF EXISTS site_promotions CASCADE;
CREATE TABLE site_promotions (
  id     SERIAL PRIMARY KEY,
  titre  VARCHAR(120),
  image  VARCHAR(255) NOT NULL,
  lien   VARCHAR(255),
  ordre  INT DEFAULT 0,
  actif  SMALLINT DEFAULT 1
);

DROP TABLE IF EXISTS site_equipe CASCADE;
CREATE TABLE site_equipe (
  id       SERIAL PRIMARY KEY,
  nom      VARCHAR(120) NOT NULL,
  fonction VARCHAR(120),
  photo    VARCHAR(255),
  ordre    INT DEFAULT 0,
  actif    SMALLINT DEFAULT 1
);

DROP TABLE IF EXISTS site_messages_contact CASCADE;
CREATE TABLE site_messages_contact (
  id         SERIAL PRIMARY KEY,
  nom        VARCHAR(120) NOT NULL,
  email      VARCHAR(150) NOT NULL,
  telephone  VARCHAR(40),
  message    TEXT NOT NULL,
  date_envoi TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  lu         SMALLINT DEFAULT 0,
  ip         VARCHAR(45)
);

DROP TABLE IF EXISTS site_newsletter CASCADE;
CREATE TABLE site_newsletter (
  id          SERIAL PRIMARY KEY,
  email       VARCHAR(150) NOT NULL UNIQUE,
  date_inscr  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS albumphoto CASCADE;
CREATE TABLE albumphoto (
  idalbumphoto BIGSERIAL PRIMARY KEY,
  matricule    VARCHAR(50),
  photo        BYTEA
);

DROP TABLE IF EXISTS groupes CASCADE;
CREATE TABLE groupes (
  idgroupes      BIGSERIAL PRIMARY KEY,
  libellegroupe  VARCHAR(50),
  niveaudacces   VARCHAR(4),
  structures     VARCHAR(50)
);

DROP TABLE IF EXISTS objectif CASCADE;
CREATE TABLE objectif (
  idobjectif      BIGSERIAL PRIMARY KEY,
  annee           VARCHAR(50),
  montant         BIGINT DEFAULT 0,
  structures      VARCHAR(50),
  structuresannee VARCHAR(50)
);

DROP TABLE IF EXISTS t_appro CASCADE;
CREATE TABLE t_appro (
  idt_appro       BIGSERIAL PRIMARY KEY,
  refarticles     VARCHAR(40),
  libarticles     VARCHAR(80),
  qteappro        DOUBLE PRECISION DEFAULT 0,
  dateappro       DATE,
  utilisateur     VARCHAR(50),
  unitevaleur     VARCHAR(12),
  fournisseur     VARCHAR(50),
  annees          VARCHAR(50),
  mois            VARCHAR(50),
  numappro        VARCHAR(50),
  structures      VARCHAR(50),
  codearticles    VARCHAR(50),
  num_lot         VARCHAR(50),
  datefabrication DATE,
  dateexpiation   DATE,
  prixachat       BIGINT DEFAULT 0,
  totalachat      BIGINT DEFAULT 0
);

DROP TABLE IF EXISTS t_articles CASCADE;
CREATE TABLE t_articles (
  idt_articles BIGSERIAL PRIMARY KEY,
  libellefa    VARCHAR(50),
  refarticles  VARCHAR(40),
  libarticles  VARCHAR(80),
  unitevaleur  VARCHAR(12),
  ok           SMALLINT DEFAULT 0,
  prixachat    BIGINT DEFAULT 0,  -- [AJOUT]
  prixvente    BIGINT DEFAULT 0,  -- [AJOUT]
  prixpromo    BIGINT DEFAULT 0  -- [AJOUT]
);

DROP TABLE IF EXISTS t_bonsorti_dp CASCADE;
CREATE TABLE t_bonsorti_dp (
  idt_bonsorti_dp BIGSERIAL PRIMARY KEY,
  structures      VARCHAR(50),
  refarticles     VARCHAR(40),
  articles        VARCHAR(50),
  unitevaleur     VARCHAR(12),
  quantitesortie  REAL DEFAULT 0,
  datesortie      DATE,
  heure           TIME,
  utilisateur     VARCHAR(50),
  numprecommande  VARCHAR(50)  -- [AJOUT] lien vers la pré-commande servie
);

DROP TABLE IF EXISTS t_client CASCADE;
CREATE TABLE t_client (
  idt_client  BIGSERIAL PRIMARY KEY,
  nomprenom   VARCHAR(50),
  contact     VARCHAR(50),
  quartier    VARCHAR(50),
  email       VARCHAR(50),
  structures  VARCHAR(50)
);

DROP TABLE IF EXISTS t_commande CASCADE;
CREATE TABLE t_commande (
  idcommande  BIGSERIAL PRIMARY KEY,
  numcmde     VARCHAR(25),
  idclient    VARCHAR(50),
  nomprenom   VARCHAR(50),
  qtetotal    BIGINT DEFAULT 0,
  mttotal     BIGINT DEFAULT 0,
  remise      BIGINT DEFAULT 0,
  mtapayer    BIGINT DEFAULT 0,
  verse       BIGINT DEFAULT 0,
  reste       BIGINT DEFAULT 0,
  moiscmde    VARCHAR(50),
  anneecmde   VARCHAR(50),
  utilisateur VARCHAR(50),
  heurecmde   TIME,
  livre       SMALLINT DEFAULT 0,
  datecmde    DATE,
  structures  VARCHAR(50)
);

DROP TABLE IF EXISTS t_compteagence CASCADE;
CREATE TABLE t_compteagence (
  idt_compteagence BIGSERIAL PRIMARY KEY,
  structures       VARCHAR(50),
  montant_total    BIGINT DEFAULT 0,
  verse            BIGINT DEFAULT 0,
  dateversement    DATE,
  utilisateur      VARCHAR(50),
  moyen            VARCHAR(50),
  reference        VARCHAR(50),
  solde            BIGINT DEFAULT 0
);

DROP TABLE IF EXISTS t_compteinterne CASCADE;
CREATE TABLE t_compteinterne (
  idcompteinterne BIGSERIAL PRIMARY KEY,
  idclient        VARCHAR(50),
  nomprenom       VARCHAR(50),
  montanttotal    BIGINT DEFAULT 0,
  montantutiliser BIGINT DEFAULT 0,
  solde           BIGINT DEFAULT 0,
  structures      VARCHAR(50)
);

DROP TABLE IF EXISTS t_depenses CASCADE;
CREATE TABLE t_depenses (
  iddepenses BIGSERIAL PRIMARY KEY,
  depense    VARCHAR(50),
  structures VARCHAR(50)
);

DROP TABLE IF EXISTS t_famille CASCADE;
CREATE TABLE t_famille (
  idt_famille BIGSERIAL PRIMARY KEY,
  libellefa   VARCHAR(50),
  numero      BIGINT DEFAULT 0
);

DROP TABLE IF EXISTS t_fermercaisse CASCADE;
CREATE TABLE t_fermercaisse (
  idt_fermercaisse         BIGSERIAL PRIMARY KEY,
  datefermer               DATE,
  caissepaiementcahs       BIGINT DEFAULT 0,
  caissepaiementecheance   BIGINT DEFAULT 0,
  caisseversement          BIGINT DEFAULT 0,
  cumulcaissejour          BIGINT DEFAULT 0,
  caissedepensejour        BIGINT DEFAULT 0,
  valeurlogicielcaissejour BIGINT DEFAULT 0,
  valeurphysiquecaissejour BIGINT DEFAULT 0,
  ecart                    BIGINT DEFAULT 0,
  utilisateur              VARCHAR(50),
  structures               VARCHAR(50),
  pointagejour             SMALLINT DEFAULT 0,
  caissefermee             SMALLINT DEFAULT 0,
  structuresdatefermer     VARCHAR(58)
);

DROP TABLE IF EXISTS t_fournisseur CASCADE;
CREATE TABLE t_fournisseur (
  idt_fournisseur BIGSERIAL PRIMARY KEY,
  fournisseur     VARCHAR(50),
  localite        VARCHAR(50),
  contact         VARCHAR(50)
);

DROP TABLE IF EXISTS t_inventaire CASCADE;
CREATE TABLE t_inventaire (
  idt_inventaire      BIGSERIAL PRIMARY KEY,
  refarticles         VARCHAR(40),
  libarticles         VARCHAR(80),
  quantitestockactuel DOUBLE PRECISION DEFAULT 0,
  unitevaleur         VARCHAR(12),
  dateinventaire      DATE,
  heure               TIME,
  mois                VARCHAR(50),
  annee               VARCHAR(5),
  utilisateur         VARCHAR(50),
  quantiteappro       DOUBLE PRECISION DEFAULT 0,
  quantitevendu       DOUBLE PRECISION DEFAULT 0,
  quantitephysique    DOUBLE PRECISION DEFAULT 0,
  quantiteecart       DOUBLE PRECISION DEFAULT 0,
  quantitejuste       DOUBLE PRECISION DEFAULT 0,
  quantiteinitial     DOUBLE PRECISION DEFAULT 0,
  structures          VARCHAR(50),
  codearticles        VARCHAR(50)
);

DROP TABLE IF EXISTS t_lignecmde CASCADE;
CREATE TABLE t_lignecmde (
  idlignecmde  BIGSERIAL PRIMARY KEY,
  idcmde       VARCHAR(30),
  refarticles  VARCHAR(40),
  libarticles  VARCHAR(80),
  qte          DOUBLE PRECISION DEFAULT 0,
  pv           BIGINT DEFAULT 0,
  totalvente   BIGINT DEFAULT 0,
  remise       BIGINT DEFAULT 0,
  mtapayer     BIGINT DEFAULT 0,
  dateenreg    DATE,
  mois         VARCHAR(50),
  annee        VARCHAR(5),
  unitevaleur  VARCHAR(12),
  structures   VARCHAR(50),
  codearticles VARCHAR(50)
);

DROP TABLE IF EXISTS t_lignecmde_modif CASCADE;
CREATE TABLE t_lignecmde_modif (
  idlignecmde_modif BIGSERIAL PRIMARY KEY,
  idcmde       VARCHAR(30),
  refarticles  VARCHAR(40),
  libarticles  VARCHAR(80),
  qte          DOUBLE PRECISION DEFAULT 0,
  pv           BIGINT DEFAULT 0,
  totalvente   BIGINT DEFAULT 0,
  remise       BIGINT DEFAULT 0,
  mtapayer     BIGINT DEFAULT 0,
  dateenreg    DATE,
  mois         VARCHAR(50),
  annee        VARCHAR(5),
  unitevaleur  VARCHAR(12),
  structures   VARCHAR(50),
  codearticles VARCHAR(50)
);

DROP TABLE IF EXISTS t_numero CASCADE;
CREATE TABLE t_numero (
  idt_numero    BIGSERIAL PRIMARY KEY,
  numsortie     VARCHAR(50),
  numappro      VARCHAR(50),
  numprod       VARCHAR(50),
  numfaprod     VARCHAR(50),
  numcb         VARCHAR(50),
  numcodarticle VARCHAR(50),
  numpreappro   VARCHAR(50)
);

DROP TABLE IF EXISTS t_paiement CASCADE;
CREATE TABLE t_paiement (
  idpaiement   BIGSERIAL PRIMARY KEY,
  numcmde      VARCHAR(25),
  client       VARCHAR(50),
  montantcmde  BIGINT DEFAULT 0,
  paye         BIGINT DEFAULT 0,
  datepaiement DATE,
  annee        VARCHAR(5),
  agent        VARCHAR(50),
  livre        SMALLINT DEFAULT 0,
  reste        BIGINT DEFAULT 0,
  verse        BIGINT DEFAULT 0,
  rendu        BIGINT DEFAULT 0,
  cash         SMALLINT DEFAULT 0,
  structures   VARCHAR(50),
  modepaiement VARCHAR(30) DEFAULT 'Espèce',  -- [AJOUT]
  heure        TIME  -- [AJOUT]
);

DROP TABLE IF EXISTS t_paiement_sl CASCADE;
CREATE TABLE t_paiement_sl (
  idpaiementsl BIGSERIAL PRIMARY KEY,
  numcmde      VARCHAR(25),
  client       VARCHAR(50),
  montantcmde  BIGINT DEFAULT 0,
  paye         BIGINT DEFAULT 0,
  datepaiement DATE,
  annee        VARCHAR(5),
  agent        VARCHAR(30),
  reste        BIGINT DEFAULT 0,
  rendu        BIGINT DEFAULT 0,
  verse        BIGINT DEFAULT 0,
  structures   VARCHAR(30),
  modepaiement VARCHAR(30) DEFAULT 'Espèce',  -- [AJOUT]
  heure        TIME  -- [AJOUT]
);

DROP TABLE IF EXISTS t_peremption CASCADE;
CREATE TABLE t_peremption (
  idt_peremption  BIGSERIAL PRIMARY KEY,
  libarticles     VARCHAR(80),
  quantitestock   DOUBLE PRECISION DEFAULT 0,
  quantitesorti   DOUBLE PRECISION DEFAULT 0,
  unitevaleur     VARCHAR(12),
  structures      VARCHAR(50),
  codearticles    VARCHAR(52),
  quantiterestant DOUBLE PRECISION DEFAULT 0,
  motif           VARCHAR(200),
  operateur       VARCHAR(50),
  dateoperation   DATE,
  heureoperation  TIME
);

DROP TABLE IF EXISTS t_precommandeagence CASCADE;
CREATE TABLE t_precommandeagence (
  idprecommandeagence BIGSERIAL PRIMARY KEY,
  idcmde         VARCHAR(50),
  refarticles    VARCHAR(40),
  libarticles    VARCHAR(80),
  qte            DOUBLE PRECISION DEFAULT 0,
  pv             BIGINT DEFAULT 0,
  totalvente     BIGINT DEFAULT 0,
  dateenreg      DATE,
  mois           VARCHAR(50),
  annee          VARCHAR(5),
  utilisateur    VARCHAR(50),
  unitevaleur    VARCHAR(12),
  structures     VARCHAR(50),
  codearticles   VARCHAR(50),
  accepter       SMALLINT DEFAULT 0,
  idcmde_ref     VARCHAR(82),
  qtevalidee     DOUBLE PRECISION DEFAULT 0,  -- [AJOUT] quantité accordée par le siège
  statut         VARCHAR(20) DEFAULT 'EN_ATTENTE',  -- [AJOUT] EN_ATTENTE / VALIDE_SIEGE / RECU_AGENCE / RETOURNE_SIEGE
  datevalidation DATE,  -- [AJOUT]
  validepar      VARCHAR(50),  -- [AJOUT]
  datereception  DATE,  -- [AJOUT]
  recupar        VARCHAR(50)  -- [AJOUT]
);

DROP TABLE IF EXISTS t_proforma CASCADE;
CREATE TABLE t_proforma (
  idproforma   BIGSERIAL PRIMARY KEY,
  idcmde       VARCHAR(50),
  refarticles  VARCHAR(40),
  libarticles  VARCHAR(80),
  qte          DOUBLE PRECISION DEFAULT 0,
  pv           BIGINT DEFAULT 0,
  totalvente   BIGINT DEFAULT 0,
  remise       BIGINT DEFAULT 0,
  mtapayer     BIGINT DEFAULT 0,
  dateenreg    DATE,
  mois         VARCHAR(50),
  annee        VARCHAR(5),
  utilisateur  VARCHAR(50),
  unitevaleur  VARCHAR(12),
  structures   VARCHAR(50),
  codearticles VARCHAR(50),
  accepter     SMALLINT DEFAULT 0,
  idcmde_ref   VARCHAR(80),
  client       VARCHAR(50)  -- [AJOUT]
);

DROP TABLE IF EXISTS t_sortieargent CASCADE;
CREATE TABLE t_sortieargent (
  idt_sortieargent BIGSERIAL PRIMARY KEY,
  depense          VARCHAR(50),
  motif            VARCHAR(50),
  montantdepense   BIGINT DEFAULT 0,
  datedepenses     DATE,
  utilisateur      VARCHAR(50),
  structures       VARCHAR(50)
);

DROP TABLE IF EXISTS t_stock CASCADE;
CREATE TABLE t_stock (
  idt_stock      BIGSERIAL PRIMARY KEY,
  refarticles    VARCHAR(40),
  libarticles    VARCHAR(80),
  quantitestock  DOUBLE PRECISION DEFAULT 0,
  quantitealerte DOUBLE PRECISION DEFAULT 0,
  unitevaleur    VARCHAR(12),
  codebarre      VARCHAR(50),
  structures     VARCHAR(50),
  codearticles   VARCHAR(50),
  prixachat      BIGINT DEFAULT 0,
  prixvente      BIGINT DEFAULT 0,
  familearticle  VARCHAR(50),
  activer        SMALLINT DEFAULT 0,
  sl             VARCHAR(121)
);

DROP TABLE IF EXISTS t_structure CASCADE;
CREATE TABLE t_structure (
  idt_structure BIGSERIAL PRIMARY KEY,
  nom_structure VARCHAR(50),
  photo         BYTEA,
  contact       VARCHAR(50),
  email         VARCHAR(100),
  mdpmail       VARCHAR(50),
  codecourt     VARCHAR(6),  -- [AJOUT] suffixe des numéros (YOP, BKE...)
  estsiege      SMALLINT DEFAULT 0  -- [AJOUT]
);

DROP TABLE IF EXISTS t_versementsa CASCADE;
CREATE TABLE t_versementsa (
  idt_versementsa BIGSERIAL PRIMARY KEY,
  idclient        VARCHAR(50),
  nomprenom       VARCHAR(50),
  montantverse    BIGINT DEFAULT 0,
  modepaiement    VARCHAR(50),
  dateversement   DATE,
  annee           VARCHAR(5),
  mois            VARCHAR(50),
  heure           TIME,
  utilisateur     VARCHAR(50),
  structures      VARCHAR(50)
);

DROP TABLE IF EXISTS utilisateurs CASCADE;
CREATE TABLE utilisateurs (
  idutilisateurs BIGSERIAL PRIMARY KEY,
  nom_prenoms    VARCHAR(150),
  niveaudacces   VARCHAR(4),
  login          VARCHAR(50),
  mot_de_passe   VARCHAR(255),
  actif_life     SMALLINT DEFAULT 0,
  groupe         VARCHAR(50),
  structures     VARCHAR(50),
  derniere_cnx   TIMESTAMP,  -- [AJOUT]
  CONSTRAINT uq_login UNIQUE (login)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_msg_lu ON site_messages_contact (lu);
CREATE INDEX IF NOT EXISTS idx_msg_date ON site_messages_contact (date_envoi);
CREATE INDEX IF NOT EXISTS wdidx_albumphoto_matricule ON albumphoto (matricule);
CREATE INDEX IF NOT EXISTS wdidx_groupes_libellegroupe ON groupes (libellegroupe);
CREATE INDEX IF NOT EXISTS wdidx_groupes_niveaudacces ON groupes (niveaudacces);
CREATE INDEX IF NOT EXISTS wdidx_groupes_structures ON groupes (structures);
CREATE INDEX IF NOT EXISTS wdidx_objectif_annee ON objectif (annee);
CREATE INDEX IF NOT EXISTS wdidx_objectif_montant ON objectif (montant);
CREATE INDEX IF NOT EXISTS wdidx_objectif_structures ON objectif (structures);
CREATE INDEX IF NOT EXISTS wdidx_objectif_structuresannee ON objectif (structuresannee);
CREATE INDEX IF NOT EXISTS wdidx_t_appro_refarticles ON t_appro (refarticles);
CREATE INDEX IF NOT EXISTS wdidx_t_appro_libarticles ON t_appro (libarticles);
CREATE INDEX IF NOT EXISTS wdidx_t_appro_qteappro ON t_appro (qteappro);
CREATE INDEX IF NOT EXISTS wdidx_t_appro_fournisseur ON t_appro (fournisseur);
CREATE INDEX IF NOT EXISTS wdidx_t_appro_numappro ON t_appro (numappro);
CREATE INDEX IF NOT EXISTS wdidx_t_appro_structures ON t_appro (structures);
CREATE INDEX IF NOT EXISTS wdidx_t_appro_codearticles ON t_appro (codearticles);
CREATE INDEX IF NOT EXISTS wdidx_t_appro_prixachat ON t_appro (prixachat);
CREATE INDEX IF NOT EXISTS wdidx_t_appro_totalachat ON t_appro (totalachat);
CREATE INDEX IF NOT EXISTS idx_appro_date ON t_appro (dateappro);
CREATE INDEX IF NOT EXISTS wdidx_t_articles_libellefa ON t_articles (libellefa);
CREATE INDEX IF NOT EXISTS wdidx_t_articles_refarticles ON t_articles (refarticles);
CREATE INDEX IF NOT EXISTS wdidx_t_articles_libarticles ON t_articles (libarticles);
CREATE INDEX IF NOT EXISTS wdidx_t_articles_unitevaleur ON t_articles (unitevaleur);
CREATE INDEX IF NOT EXISTS wdidx_t_bonsorti_dp_structures ON t_bonsorti_dp (structures);
CREATE INDEX IF NOT EXISTS wdidx_t_bonsorti_dp_refarticles ON t_bonsorti_dp (refarticles);
CREATE INDEX IF NOT EXISTS wdidx_t_bonsorti_dp_articles ON t_bonsorti_dp (articles);
CREATE INDEX IF NOT EXISTS wdidx_t_bonsorti_dp_unitevaleur ON t_bonsorti_dp (unitevaleur);
CREATE INDEX IF NOT EXISTS wdidx_t_bonsorti_dp_datesortie ON t_bonsorti_dp (datesortie);
CREATE INDEX IF NOT EXISTS wdidx_t_client_nomprenom ON t_client (nomprenom);
CREATE INDEX IF NOT EXISTS wdidx_t_client_structures ON t_client (structures);
CREATE INDEX IF NOT EXISTS wdidx_t_commande_numcmde ON t_commande (numcmde);
CREATE INDEX IF NOT EXISTS wdidx_t_commande_idclient ON t_commande (idclient);
CREATE INDEX IF NOT EXISTS wdidx_t_commande_nomprenom ON t_commande (nomprenom);
CREATE INDEX IF NOT EXISTS wdidx_t_commande_qtetotal ON t_commande (qtetotal);
CREATE INDEX IF NOT EXISTS wdidx_t_commande_utilisateur ON t_commande (utilisateur);
CREATE INDEX IF NOT EXISTS wdidx_t_commande_livre ON t_commande (livre);
CREATE INDEX IF NOT EXISTS wdidx_t_commande_datecmde ON t_commande (datecmde);
CREATE INDEX IF NOT EXISTS wdidx_t_commande_structures ON t_commande (structures);
CREATE INDEX IF NOT EXISTS wdidx_t_compteagence_structures ON t_compteagence (structures);
CREATE INDEX IF NOT EXISTS wdidx_t_compteagence_montant_total ON t_compteagence (montant_total);
CREATE INDEX IF NOT EXISTS wdidx_t_compteagence_verse ON t_compteagence (verse);
CREATE INDEX IF NOT EXISTS wdidx_t_compteagence_dateversement ON t_compteagence (dateversement);
CREATE INDEX IF NOT EXISTS wdidx_t_compteagence_solde ON t_compteagence (solde);
CREATE INDEX IF NOT EXISTS wdidx_t_compteinterne_idclient ON t_compteinterne (idclient);
CREATE INDEX IF NOT EXISTS wdidx_t_compteinterne_nomprenom ON t_compteinterne (nomprenom);
CREATE INDEX IF NOT EXISTS wdidx_t_compteinterne_montanttotal ON t_compteinterne (montanttotal);
CREATE INDEX IF NOT EXISTS wdidx_t_compteinterne_montantutiliser ON t_compteinterne (montantutiliser);
CREATE INDEX IF NOT EXISTS wdidx_t_compteinterne_solde ON t_compteinterne (solde);
CREATE INDEX IF NOT EXISTS wdidx_t_compteinterne_structures ON t_compteinterne (structures);
CREATE INDEX IF NOT EXISTS wdidx_t_depenses_depense ON t_depenses (depense);
CREATE INDEX IF NOT EXISTS wdidx_t_depenses_structures ON t_depenses (structures);
CREATE INDEX IF NOT EXISTS wdidx_t_famille_libellefa ON t_famille (libellefa);
CREATE INDEX IF NOT EXISTS idx_fc_date ON t_fermercaisse (datefermer);
CREATE INDEX IF NOT EXISTS idx_fc_struct ON t_fermercaisse (structures);
CREATE INDEX IF NOT EXISTS idx_fc_sdf ON t_fermercaisse (structuresdatefermer);
CREATE INDEX IF NOT EXISTS idx_inv_date ON t_inventaire (dateinventaire);
CREATE INDEX IF NOT EXISTS idx_inv_struct ON t_inventaire (structures);
CREATE INDEX IF NOT EXISTS idx_inv_code ON t_inventaire (codearticles);
CREATE INDEX IF NOT EXISTS idx_lc_cmde ON t_lignecmde (idcmde);
CREATE INDEX IF NOT EXISTS idx_lc_date ON t_lignecmde (dateenreg);
CREATE INDEX IF NOT EXISTS idx_lc_struct ON t_lignecmde (structures);
CREATE INDEX IF NOT EXISTS idx_lc_code ON t_lignecmde (codearticles);
CREATE INDEX IF NOT EXISTS idx_lcm_cmde ON t_lignecmde_modif (idcmde);
CREATE INDEX IF NOT EXISTS idx_p_cmde ON t_paiement (numcmde);
CREATE INDEX IF NOT EXISTS idx_p_date ON t_paiement (datepaiement);
CREATE INDEX IF NOT EXISTS idx_p_struct ON t_paiement (structures);
CREATE INDEX IF NOT EXISTS idx_psl_cmde ON t_paiement_sl (numcmde);
CREATE INDEX IF NOT EXISTS idx_psl_date ON t_paiement_sl (datepaiement);
CREATE INDEX IF NOT EXISTS idx_psl_struct ON t_paiement_sl (structures);
CREATE INDEX IF NOT EXISTS idx_per_struct ON t_peremption (structures);
CREATE INDEX IF NOT EXISTS idx_per_date ON t_peremption (dateoperation);
CREATE INDEX IF NOT EXISTS idx_pca_cmde ON t_precommandeagence (idcmde);
CREATE INDEX IF NOT EXISTS idx_pca_struct ON t_precommandeagence (structures);
CREATE INDEX IF NOT EXISTS idx_pca_statut ON t_precommandeagence (statut);
CREATE INDEX IF NOT EXISTS idx_pf_cmde ON t_proforma (idcmde);
CREATE INDEX IF NOT EXISTS idx_pf_struct ON t_proforma (structures);
CREATE INDEX IF NOT EXISTS idx_sa_date ON t_sortieargent (datedepenses);
CREATE INDEX IF NOT EXISTS idx_sa_struct ON t_sortieargent (structures);
CREATE INDEX IF NOT EXISTS idx_st_ref ON t_stock (refarticles);
CREATE INDEX IF NOT EXISTS idx_st_struct ON t_stock (structures);
CREATE INDEX IF NOT EXISTS idx_st_code ON t_stock (codearticles);
CREATE INDEX IF NOT EXISTS idx_st_lib ON t_stock (libarticles);
CREATE INDEX IF NOT EXISTS idx_struct_nom ON t_structure (nom_structure);

-- =====================================================================
--  Notifications WhatsApp (workflow des pré-commandes)
-- =====================================================================
ALTER TABLE t_structure ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(120);   -- numéros WhatsApp de l'agence (séparés par des virgules)

CREATE TABLE IF NOT EXISTS t_parametres (
  cle    VARCHAR(60) PRIMARY KEY,
  valeur TEXT
);

CREATE TABLE IF NOT EXISTS t_notification (
  idnotification BIGSERIAL PRIMARY KEY,
  datecreation   TIMESTAMP DEFAULT NOW(),
  evenement      VARCHAR(30),      -- PRECOMMANDE / VALIDATION / RECEPTION / RETOUR / TEST
  reference      VARCHAR(60),      -- n° de pré-commande
  structures     VARCHAR(50),      -- agence concernée
  destinataire   VARCHAR(30),      -- numéro WhatsApp (format international sans +)
  message        TEXT,
  fournisseur    VARCHAR(20),
  statut         VARCHAR(12) DEFAULT 'EN_COURS',  -- EN_COURS / ENVOYE / ECHEC / MANUEL
  erreur         TEXT,
  dateenvoi      TIMESTAMP,
  utilisateur    VARCHAR(50)
);
CREATE INDEX IF NOT EXISTS idx_notif_date ON t_notification (datecreation);

-- Inventaires : numéro de fiche et date de début de période
ALTER TABLE t_inventaire ADD COLUMN IF NOT EXISTS numinventaire VARCHAR(40);
ALTER TABLE t_inventaire ADD COLUMN IF NOT EXISTS datedebut DATE;
CREATE INDEX IF NOT EXISTS idx_inv_num ON t_inventaire (numinventaire);

-- Versements des agences au siège : lien versement -> paiements des factures
ALTER TABLE t_paiement_sl ADD COLUMN IF NOT EXISTS idversement BIGINT;
ALTER TABLE t_compteagence ADD COLUMN IF NOT EXISTS factures TEXT;
