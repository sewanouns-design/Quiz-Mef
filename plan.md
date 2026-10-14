# Plan — Navigation admin personnalisable et Analytics

## Objectif

Permettre au super-administrateur de réorganiser entièrement la navigation d’administration (noms, icônes, ordre, groupes principaux et sous-onglets) et ajouter un onglet **Analytics** professionnel pour comprendre l’audience et les parcours du site.

## Décisions produit

- La configuration de navigation est persistée dans `site_settings.admin_navigation` ; elle survit aux déploiements.
- Un groupe principal peut être réordonné avec tous ses sous-onglets, ou fusionné dans un autre groupe pour transformer ses onglets en sous-onglets.
- Un sous-onglet peut être déplacé dans une autre catégorie ou promu en onglet principal.
- Les contenus administratifs existants restent les mêmes : seule leur organisation et leur libellé changent.
- Analytics est propriétaire et intégré au site : aucune dépendance à un service public externe. Le suivi est pseudonyme et ne conserve pas l’adresse IP ni les champs saisis.
- Les événements enregistrent les pages vues, les clics utiles, le type d’appareil, le navigateur, le système, le pays fourni par l’infrastructure Vercel, le référent et l’identifiant de session anonyme.

## Design

- **Mouvement** : cockpit éditorial moderne, dense mais lisible.
- **Principes** : hiérarchie forte, actions réversibles, tableaux cliquables, filtres toujours visibles.
- **Palette** : marine pour les regroupements, accent du site pour les états actifs, couleurs sémantiques pour les indicateurs.
- **Structure** : Analytics en onglet principal avec cartes KPI, courbes temporelles CSS, tableaux de pays/pages/appareils et parcours de sessions.
- **Interaction** : clic sur une ligne de pays, page ou appareil pour filtrer les données ; sélecteur de période réutilisable.

## Implémentation

- `lib/admin-navigation.ts` : schéma, valeurs par défaut et normalisation de la navigation.
- `components/admin/DashboardClient.tsx` : rendu dynamique de la navigation persistée.
- `components/admin/NavigationTab.tsx` + `app/api/admin/navigation/route.ts` : éditeur et sauvegarde sécurisée.
- `components/admin/AnalyticsTab.tsx` + `app/api/admin/analytics/route.ts` : tableau de bord et agrégations.
- `components/AnalyticsTracker.tsx` + `app/api/analytics/events/route.ts` : collecte pseudonyme des pages et interactions.
- `lib/analytics.ts` : détection serveur appareil/navigateur/OS et validation des événements.
- `schema.sql` et migration Supabase : colonne de navigation, table d’événements, index, RLS et fonction d’agrégation.

## Contraintes

- Les routes admin exigent la session administrateur et une origine valide pour les écritures.
- Les événements publics sont limités en taille et ne stockent pas l’adresse IP.
- L’API Analytics ne retourne que des agrégats ou des parcours anonymisés.
- Le suivi exclut les pages `/admin` afin de mesurer l’audience publique.

## Centre de contrôle des notifications push

- `components/admin/PushNotificationsTab.tsx` présente le sous-onglet dédié, inspiré de la capture fournie : carte d’introduction, cartes de compteurs, activation sur l’appareil admin, interrupteurs d’événements, bouton Enregistrer, abonnements récents et historique des diffusions.
- `app/api/admin/push/route.ts` retourne exclusivement à l’administration les compteurs d’abonnements, les appareils anonymes/identifiés, les nouveaux abonnements et l’historique des envois.
- `lib/push.ts` journalise chaque diffusion avec le nombre ciblé, envoyé, en échec et retiré automatiquement lorsqu’un abonnement est expiré.
- Le tableau de bord est ajouté à la navigation persistée sous « Édition > Notifications push » ; les réglages ne sont plus dupliqués dans « Apparence ».
- Les données d’abonnement restent limitées à l’administration et les endpoints sont masqués dans l’interface par une forme abrégée.

## Visuels de résultats partagés

- Le partage WhatsApp conserve le modèle classique et ajoute un modèle « célébration » inspiré de la capture fournie.
- L’administrateur choisit le modèle dans Apparence, importe un fond personnalisé et règle la position verticale du titre, du nom et du score afin de laisser des espaces propres dans son visuel.
- Le générateur Canvas superpose automatiquement les données réelles du résultat au modèle choisi ; si le fond personnalisé est absent ou invalide, le modèle célébration sert de repli.
- Les calques des deux familles de visuels sont enregistrés séparément en JSON : texte libre ou variables, visibilité, position, largeur, taille, couleur, graisse et alignement.
- Le modèle trimestriel est conçu comme un visuel de distinction sobre : il ne porte pas le mot « certificat », mais présente clairement le rang, la période et les résultats du gagnant.
