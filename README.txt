AGP & Vous — Administration V2

Cette version conserve la base Firebase existante et ajoute :
- création, modification et suppression des actualités ;
- création, modification et suppression des activités ;
- publication ou masquage d'un contenu ;
- affichage automatique des actualités sur l'accueil ;
- affichage automatique des activités dans l'agenda ;
- accès de l'administratrice à l'espace adhérents ;
- activation du service worker ;
- règles renforcées : seuls les profils users avec role member ou admin accèdent au privé.

MISE EN LIGNE
1. Copier les fichiers dans le dépôt agp-et-vous-dev en remplaçant les anciens.
2. Publier les nouvelles règles : Firebase > Firestore Database > Rules.
3. Coller le contenu de firestore.rules puis cliquer sur Publier.
4. Envoyer les fichiers vers GitHub.
5. Recharger le site. En cas d'ancienne version en cache, fermer puis rouvrir l'onglet.

PROFIL ADMINISTRATEUR REQUIS
Collection : users
Document ID : UID Firebase du compte administrateur
Champs :
- firstName (string) = Stéphanie
- role (string) = admin
- email (string) = adresse de connexion

IMPORTANT
Tout autre adhérent devra aussi avoir un document dans users avec role = member.
Un simple compte Authentication sans fiche users n'accède plus aux informations privées.

Collections utilisées :
- publicNews
- publicActivities
- classifieds
- aid
- artisans
- privateInfo
- users
