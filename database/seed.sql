-- KFN PHARMA — données de départ (PostgreSQL)
-- =====================================================================
--  DONNÉES INITIALES
-- =====================================================================

INSERT INTO site_parametres (cle, valeur, libelle) VALUES
('nom','KFN PHARMA','Nom de la société'),
('slogan','Le fournisseur N°1 du matériel médical','Slogan'),
('email','infos@kfnpharma.com','E-mail'),
('telephone1','(+225) 01 43 43 43 19','Téléphone 1'),
('telephone2','(+225) 05 05 44 44 44','Téléphone 2'),
('telephone3','(+225) 07 08 56 36 57','Téléphone 3'),
('adresse','Abidjan – Yopougon Nouvelle Gare UTB, rez-de-chaussée de l''immeuble collé à la Gare','Adresse'),
('horaires_semaine','Lun – Sam : 08:00 – 18:00','Horaires semaine'),
('horaires_weekend','Dimanche : 08:00 – 14:00','Horaires week-end'),
('facebook','https://facebook.com/','Facebook'),
('instagram','https://instagram.com/','Instagram'),
('linkedin','https://linkedin.com/','LinkedIn'),
('a_propos','KFN Pharma SARL fournit, installe et entretient du matériel biomédical pour les hôpitaux, cliniques, centres de santé et cabinets médicaux de Côte d''Ivoire. Depuis notre siège de Yopougon et nos agences de l''intérieur du pays, nous livrons des équipements fiables, au juste prix, avec un suivi technique après la vente.','Texte À propos');

INSERT INTO site_slides (titre, sous_titre, image, bouton_texte, bouton_lien, ordre) VALUES
('Professionnels de la santé, fournissez-vous en matériel chez KFN Pharma','Mobilier hospitalier, diagnostic, consommables : tout votre équipement au même endroit.','assets/img/slide1.jpg','Nous contacter','#contact',1),
('Le meilleur du diagnostic, une technologie accessible','Otoscopes, échographes, moniteurs : des marques fiables et des offres imbattables sur le consommable.','assets/img/slide2.jpg','Voir nos services','#services',2),
('Chariots d''urgence, stéthoscopes, équipements de soins','Les meilleurs prix sur le matériel de soins du quotidien, livrés dans toutes nos agences.','assets/img/promo-chariot.jpg','Demander un devis','#contact',3);

INSERT INTO site_services (titre, resume, icone, ordre) VALUES
('Service Entretien','Maintenir en état le caractère fonctionnel et opérationnel du matériel biomédical vendu et assurer le suivi chez nos clients.','entretien',1),
('Service Installation','Le montage et l''assemblage du matériel biomédical vendu, sur site, par nos techniciens.','installation',2),
('Service Vente','Le cœur d''activité de KFN Pharma SARL : mettre à la disposition de notre clientèle des produits biomédicaux de qualité.','vente',3);

INSERT INTO site_activites (titre, description, ordre) VALUES
('Matériel de diagnostic','Tensiomètres, stéthoscopes, otoscopes, thermomètres, oxymètres de pouls et échographes.',1),
('Mobilier hospitalier','Lits, tables d''examen et de pansement, chaises roulantes, chariots d''urgence et à instruments.',2),
('Consommables médicaux','Seringues, aiguilles, sondes, compresses, bandes, coton, gants et petit matériel de soins.',3),
('Stérilisation & laboratoire','Stérilisateurs à vapeur, réactifs (Giemsa), équipements et fournitures de laboratoire.',4);

INSERT INTO site_competences (libelle, pourcentage, ordre) VALUES
('Vente',100,1),('Entretien',100,2),('Installation',100,3);

INSERT INTO site_promotions (titre, image, lien, ordre) VALUES
('Chariot d''urgences','assets/img/promo-chariot.jpg','#contact',1),
('Stéthoscope professionnel','assets/img/promo-stetho.jpg','#contact',2);

INSERT INTO site_equipe (nom, fonction, photo, ordre) VALUES
('Mike Jason','Business Advisor','assets/img/team1.jpg',1),
('Francis Ibikunle','Senior Consultant','assets/img/team2.jpg',2),
('Ara Gates','Finance Consultant','assets/img/team3.jpg',3),
('Claire Divas','Business Advisor','assets/img/team4.jpg',4);

-- Agences
INSERT INTO T_Structure (Nom_Structure, Contact, Email, CodeCourt, EstSiege) VALUES
('AGENCE SIEGE','(+225) 01 43 43 43 19','infos@kfnpharma.com','SIE',1),
('YOP 3E PONT UTB','','', 'YOP',0),
('GAGNOA','','','GAG',0),
('YAMOUSSOUKRO','','','YAM',0),
('AGBOVILLE','','','AGB',0),
('BOUAKE','','','BKE',0),
('DIVO','','','DIV',0),
('SAN-PEDRO','','','SPE',0),
('OUME','','','OUM',0),
('DALOA','','','DAL',0),
('BONDOUKOU','','','BDK',0);

-- Groupes / profils (niveaudacces)
INSERT INTO groupes (libellegroupe, niveaudacces, Structures) VALUES
('Super Admin','SUP','AGENCE SIEGE'),
('Administrateur','ADM','AGENCE SIEGE'),
('Responsable d''agence','RAG',''),
('Gestionnaire stock','GST',''),
('Caissier(ère)','CAI',''),
('Vendeur(se)','VEN',''),
('Consultation','CON','');

-- Comptes de départ (mots de passe chiffrés automatiquement à la première connexion)
--   superadmin / Super@2026  : Super Admin (développeur) — peut tout faire
--   admin      / Admin@2026  : Administrateur
INSERT INTO utilisateurs (nom_prenoms, niveaudacces, login, mot_de_passe, actif_life, groupe, Structures) VALUES
('FACTORIEL','SUP','superadmin','Super@2026',1,'Super Admin','AGENCE SIEGE'),
('ADMINISTRATEUR KFN','ADM','admin','Admin@2026',1,'Administrateur','AGENCE SIEGE');

INSERT INTO T_Numero (NumSortie, NumAppro, NumProd, NumFaProd, NumCB, NumCodarticle, NumPreAppro)
VALUES ('0','0','0','0','0','0','0');

INSERT INTO T_Fournisseur (Fournisseur, Localite, Contact) VALUES
('FOURNISSEUR DIVERS','Abidjan',''),
('IMPORT DIRECT','Abidjan','');

INSERT INTO T_Depenses (Depense, Structures) VALUES
('Transport',''),('Carburant',''),('Électricité',''),('Eau',''),('Fournitures de bureau',''),('Restauration',''),('Divers','');

INSERT INTO T_Famille (LibelleFa, Numero) VALUES
('SERINGUE',1),('AIGUILLE',2),('SONDE',3),('BANDE',4),('COMPRESSE',5),('CHAISE ROULANTE',6),
('TABLE',7),('CHARIOT',8),('DIAGNOSTIC',9),('KIT',10),('ALCOOL',11),('TUBE',12),('BERCEAU',13),('COTON',14);

INSERT INTO T_Articles (LibelleFa, RefArticles, LibArticles, UniteValeur, PrixAchat, PrixVente) VALUES
('SERINGUE','10ML','SERINGUE 10 ML','Unité',1500,2500),
('SERINGUE','1ML','SERINGUE INSULINE','Unité',2500,4000),
('SERINGUE','20ML','SERINGUE 20ML','Unité',2200,3500),
('SERINGUE','5ML','SERINGUES 5ML','Unité',1700,2800),
('SONDE','2SF14','2V-SONDE FOLEY 14FR','Unité',1800,3000),
('SONDE','2SF16','2V-SONDE FOLEY 16FR','Unité',1800,3000),
('SONDE','3SF20','3V-SONDE FOLEY 20FR','Unité',1800,3000),
('AIGUILLE','AIP21G','AIGUILLE PLVENT 21G','Unité',1800,3000),
('AIGUILLE','AIG22','AIGUILLE PL 22G','Unité',200,350),
('BANDE','BD10','BANDE 10CM','Unité',300,500),
('BANDE','BD15','BANDE 15CM','Unité',400,700),
('COMPRESSE','CMPST120','COMPRESSE STERILE','Unité',300,500),
('DIAGNOSTIC','ABL','ABAISSE LANGUE','Unité',400,700),
('DIAGNOSTIC','OXY2','OXYMETRE DE POULS','Unité',50000,80000),
('DIAGNOSTIC','TENS1','TENSIOMETRE MANUEL','Unité',12000,18000),
('CHARIOT','CHAS1','CHARIOT STAINLESS','Unité',400000,600000),
('CHARIOT','CHAF5','CHARIOT FAUBERT','Unité',100000,150000),
('CHAISE ROULANTE','CR65','CHAISE ROULANTE SIMPLE','Unité',45000,70000),
('TABLE','TAB2','TABLE DE PANSEMENT','Unité',5000,7000),
('COTON','CTN1000G','COTTON 1KG','Unité',2750,4000),
('KIT','TAPIS','TAPIS ROULANT','Unité',300000,450000),
('KIT','ITA24','INTRANULE JAUNE','Unité',150,300);

-- Stock initial du siège à partir du catalogue
INSERT INTO T_Stock (RefArticles, LibArticles, Quantitestock, QuantiteAlerte, UniteValeur, Structures, CodeArticles, PrixAchat, PrixVente, FamileArticle, Activer)
SELECT RefArticles, LibArticles, 100, 5, UniteValeur, 'AGENCE SIEGE', CONCAT('AGENCE SIEGE', RefArticles), PrixAchat, PrixVente, LibelleFa, 1
FROM T_Articles;

INSERT INTO T_client (Nomprenom, contact, quartier, email, Structures) VALUES
('AFRICAN HEALTH','0707070707','Plateau','','YOP 3E PONT UTB'),
('CLIENT COMPTANT','','','','YOP 3E PONT UTB');

INSERT INTO Objectif (annee, MONTANT, Structures, Structuresannee) VALUES
('2026',25000000,'AGENCE SIEGE','AGENCE SIEGE2026'),
('2026',10000000,'YOP 3E PONT UTB','YOP 3E PONT UTB2026');

-- Paramètres WhatsApp par défaut (désactivé : à configurer dans ADMIN → Notifications WhatsApp)
INSERT INTO t_parametres (cle, valeur) VALUES
('wa_fournisseur','aucun'), ('wa_evt_precommande','1'), ('wa_evt_validation','1'), ('wa_evt_reception','1'), ('wa_siege_numeros','')
ON CONFLICT (cle) DO NOTHING;
