# Plan — Lecture publique de la leçon du jour

## Objectif

Afficher la leçon quotidienne issue de la source trimestrielle active avant le quiz, avec une présentation mobile inspirée des captures fournies, tout en gardant le bouton du quiz visible et direct.

## Design

- **Mouvement** : lecture éditoriale mobile, inspirée d’une fiche de méditation moderne.
- **Principes** : hiérarchie forte, lecture confortable, sections courtes, CTA explicites.
- **Palette** : en-tête bleu profond pour distinguer la date et le titre ; cartes blanches et fonds pastel pour réduire la fatigue visuelle ; accent du site pour l’action quiz.
- **Structure** : page verticale en une colonne, avec retour accueil, en-tête date/titre, bouton lecture/quiz, essentiel, développement, référence, prière et clôture.
- **Interaction** : « Lire la leçon du jour » reste séparé de « Passer le quiz du jour ». Le menu contient aussi un accès stable à la page.
- **Source** : lire `lesson_sources.source_text` active côté serveur et extraire uniquement la date locale du jour avec le même périmètre que l’automatisation.

## Implémentation

- `lib/daily-lesson.ts` structure la source en titre, référence, corps, essentiel, prière et lecture annuelle.
- `app/lecon/page.tsx` affiche la page publique mobile.
- Les trois modèles d’accueil ajoutent le lien de lecture avant le CTA quiz.
- `SiteMenu` ajoute « Leçon du jour ».

## Contraintes

- Aucun PDF complet côté client.
- Aucun changement dans la route de participation au quiz.
- En l’absence de leçon active pour la date, afficher un état explicite et un lien vers les quiz.
- Respecter la source active, `lesson_start` et le fuseau `Africa/Porto-Novo`.
