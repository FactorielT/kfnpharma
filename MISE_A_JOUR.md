# KFN PHARMA — mise à jour (20/10/2026)

## Corrections
1. **Changement de compte (« Travailler en tant que »)** et **barre de progression** ne fonctionnaient pas après le
   déploiement sur Render : les navigateurs gardaient en cache l'ancien `app.js` (cache de 7 jours).
   - Les liens CSS / JS portent maintenant une empreinte (`app.js?v=…`) qui change à chaque mise à jour :
     le navigateur charge automatiquement la nouvelle version, sans vider le cache.
   - Les fichiers sans empreinte sont revérifiés à chaque chargement (`Cache-Control: no-cache`).
2. Le menu « Travailler en tant que » s'ouvre toujours (flèche ⌄ sur la pastille du profil). S'il n'y a qu'une
   affectation, il indique comment en ajouter (ADMIN → Utilisateurs).
3. Barre de progression après chaque validation : pleine à 100 %, régresse en 4 secondes, s'arrête quand la
   souris est dessus et reprend quand on la retire.

## Fichiers modifiés
- `server.js` — en-têtes de cache des fichiers statiques
- `src/core.js` — empreinte des fichiers CSS/JS (`ASSET_V`, `asset()`)
- `src/web.js` — liens versionnés, menu « Travailler en tant que »
- `src/site.js` — liens versionnés du site internet
- `public/assets/css/app.css`, `public/assets/css/shell.css`, `public/assets/js/app.js`

## Déployer (Git + Render)
```
# dans le dossier de votre dépôt, remplacez les fichiers par ceux de cette archive
# (ne remplacez pas votre fichier .env s'il existe ; il n'est pas dans l'archive)
git add -A
git commit -m "Correctif : cache CSS/JS versionné, menu Travailler en tant que, barre de progression"
git push
```
Render redéploie automatiquement après le `git push` (sinon : *Manual Deploy → Deploy latest commit*).
Aucune modification de base de données n'est nécessaire.

**Une seule fois** après ce déploiement, faites **Ctrl + F5** (ou fermez puis rouvrez l'onglet sur téléphone) :
c'est l'ancien fichier, encore en cache, qui doit être remplacé. Les mises à jour suivantes seront prises en compte
automatiquement.
