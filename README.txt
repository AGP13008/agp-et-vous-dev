AGP & Vous — Firebase V1

À déposer dans le dépôt agp-et-vous-dev.

Après publication :
1. Firebase > Authentication > Settings > Authorized domains
2. Ajouter : agp13008.github.io
3. Firestore Database > Rules
4. Coller le contenu de firestore.rules puis Publier
5. Authentication > Users > Add user : créer ton compte
6. Copier l'UID de ton compte
7. Firestore > Start collection : users
8. Document ID = ton UID
9. Champs :
   firstName (string) = Stéphanie
   role (string) = admin
   email (string) = ton adresse de connexion

Collections privées prévues :
classifieds, aid, artisans, privateInfo

Cette version ne permet pas encore de créer des contenus depuis le tableau de bord.
Elle teste réellement la connexion, le rôle et la lecture privée.
