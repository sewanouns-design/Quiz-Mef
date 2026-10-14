# Résultats attendus — Navigation admin et Analytics

## Navigation d’administration entièrement personnalisable

- L’administrateur peut renommer le libellé et modifier l’icône de chaque onglet principal.
- L’administrateur peut renommer chaque sous-onglet, modifier son groupe, le réordonner et le déplacer dans une autre catégorie.
- Un groupe principal peut être réordonné avec tous ses sous-onglets, ou fusionné dans une autre catégorie avec l’ensemble de ses sous-onglets.
- Un sous-onglet peut être promu en onglet principal sans perdre son contenu.
- La configuration est sauvegardée en base, rechargée après reconnexion et réinitialisable avec la structure par défaut.
- Les routes et contenus existants restent accessibles après toute réorganisation.

## Analytics complet du site

- Le site collecte les pages vues, les parcours de session et les clics utiles sans conserver d’adresse IP ni de champ saisi.
- Les événements incluent la période, la page, le référent, le pays, le type d’appareil, le navigateur et le système d’exploitation.
- L’onglet Analytics affiche les visites, visiteurs uniques, sessions, pages par session, taux de rebond, pays, pages, appareils, navigateurs, systèmes et parcours les plus fréquents.
- Les filtres de période et les tableaux d’Analytics sont interactifs et permettent d’isoler un pays, une page ou un type d’appareil.
- Les routes de collecte sont publiques et limitées ; les routes de consultation sont réservées à l’administration.

## Livraison

- TypeScript, build Next.js et contrôle de formatage passent.
- La migration Supabase est appliquée au projet de production.
- La version publiée est vérifiée sur les routes admin, Analytics et collecte d’événements.
