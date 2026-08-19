# Tour d'Horizon — Portfolio 360°

Site statique pour présenter vos travaux en images panorama 360°, avec un visualiseur immersif intégré. Conçu pour être hébergé gratuitement sur **GitHub Pages**, avec les médias stockés directement dans le dépôt GitHub.

## 1. Mettre le site en ligne (une seule fois)

1. Créez un nouveau dépôt sur GitHub (ex. `mon-portfolio-360`), **public** (les dépôts privés ne fonctionnent pas avec GitHub Pages gratuit).
2. Ajoutez tous les fichiers de ce dossier à la racine du dépôt :
   - via l'interface web : bouton **Add file → Upload files**, glissez tout le contenu de ce dossier (y compris le dossier `images/`) ;
   - ou en ligne de commande :
     ```
     git init
     git add .
     git commit -m "Premier déploiement"
     git branch -M main
     git remote add origin https://github.com/<votre-compte>/<votre-depot>.git
     git push -u origin main
     ```
3. Dans le dépôt GitHub : **Settings → Pages → Source** → choisissez `Deploy from a branch`, branche `main`, dossier `/ (root)` → **Save**.
4. Après 1 à 2 minutes, votre site est visible à :
   `https://<votre-compte>.github.io/<votre-depot>/`

## 2. Autoriser le site à publier vos travaux

Le site utilise l'API GitHub pour écrire directement dans votre dépôt (image + fiche du travail) quand vous cliquez sur **Publier**. Il vous faut un jeton d'accès :

1. Sur GitHub : **Settings (compte) → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Donnez-lui un nom, une expiration raisonnable (ex. 90 jours).
3. **Repository access** : « Only select repositories » → choisissez votre dépôt `mon-portfolio-360`.
4. **Permissions → Repository permissions → Contents** : `Read and write`.
5. Générez le jeton et copiez-le (il ne sera affiché qu'une fois).
6. Sur votre site, cliquez sur l'icône **⚙** dans la barre de navigation, renseignez :
   - Propriétaire / dépôt : `<votre-compte>/<votre-depot>`
   - Branche : `main`
   - Jeton : collez-le ici
7. Enregistrez. Le point à côté de « GitHub » devient vert.

⚠️ Le jeton est stocké uniquement dans le stockage local de **votre** navigateur — il n'est jamais envoyé ailleurs qu'à `api.github.com`. Ne l'utilisez pas sur un ordinateur partagé, et révoquez-le depuis GitHub si besoin.

## 3. Ajouter un travail

Cliquez sur **+ Ajouter un travail**, renseignez le titre, le lieu, la catégorie, et choisissez votre image panorama (idéalement au format **équirectangulaire**, ratio 2:1 — c'est le format standard produit par les caméras 360° ou les logiciels de stitching). Cliquez sur **Publier** : le site envoie l'image dans `images/` et met à jour `works.json` dans votre dépôt. GitHub Pages republie automatiquement le site en général en moins d'une minute.

## 4. Structure du projet

```
index.html      → la page du site
style.css        → tous les styles
main.js          → galerie, visualiseur 360° (Three.js), intégration GitHub
works.json       → la liste de vos travaux (généré/mis à jour automatiquement)
images/          → vos photos panorama (générées/mises à jour automatiquement)
```

Vous pouvez aussi ajouter ou modifier des travaux directement en éditant `works.json` et en déposant des images dans `images/` à la main, sans passer par le formulaire — chaque entrée suit ce format :

```json
{
  "id": 1732000000000,
  "title": "Villa des Almadies",
  "place": "Dakar, Sénégal",
  "tag": "Architecture",
  "image": "images/villa-des-almadies-1732000000000.jpg"
}
```

## 5. Limites à connaître

- GitHub Pages est un hébergement **statique** : il n'y a pas de base de données, tout est stocké sous forme de fichiers dans le dépôt (c'est ce que fait ce site).
- L'API GitHub utilisée ici gère bien les images jusqu'à quelques Mo. Pour des fichiers très volumineux (> 20-25 Mo), préférez un ajout manuel via `git` ou Git LFS.
- Un dépôt public signifie que vos images sont visibles par tous — normal pour un portfolio, à garder en tête si certains projets sont confidentiels.
