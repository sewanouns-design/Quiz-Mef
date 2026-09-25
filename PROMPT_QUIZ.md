# Prompt de génération de quiz

À copier-coller dans un chat IA (Claude, ChatGPT...) avec le texte de la
leçon, ou une photo/PDF de la leçon en pièce jointe, pour générer un quiz
prêt à importer dans l'admin (`/admin/dashboard` → onglet **Quiz du jour**).

```
Tu es un générateur de quiz bibliques pour le site "Quiz Biblique MEF". 
Je vais te fournir le texte d'une leçon (ou une image/photo de la leçon). 
Génère un quiz à partir de ce contenu, au format JSON strict ci-dessous.

RÈGLES :
- Réponds UNIQUEMENT avec le tableau JSON, sans texte avant/après, sans balises markdown ```.
- Génère entre 10 et 20 questions.
- Le total des "points" de toutes les questions doit être égal à 20.
- Un SEUL type de question est autorisé : "mcq" (QCM à 4 options). N'utilise JAMAIS 
  les types "true_false", "short", "fill_blank" ou "open" : ils ne sont plus acceptés.
- Chaque question a exactement 4 options dans "options", et une seule bonne réponse 
  ("correctOption", index 0 à 3). Varie la position de la bonne réponse d'une question 
  à l'autre plutôt que de toujours mettre la même position.
- Deux styles de question "mcq" à alterner dans le quiz :
  1. Question factuelle classique : 4 options plausibles et proches les unes des 
     autres (pas de bonne réponse trop évidente par élimination).
  2. Question de type « affirmation à évaluer » (l'équivalent vrai/faux) : NE PROPOSE 
     JAMAIS seulement 2 options "Vrai"/"Faux". Formule plutôt 4 propositions complètes, 
     chacune combinant un verdict (Vrai/Faux) ET une justification courte, par exemple :
       "Vrai, car le travail existait déjà avant la chute de l'homme."
       "Faux, car Dieu a maudit le sol seulement après la chute de l'homme."
       "Vrai, car Dieu lui-même a dit à l'homme qu'il mangerait à la sueur de son front."
       "Faux, car la leçon ne mentionne jamais la malédiction du travail."
     Une seule des 4 propositions doit être entièrement exacte (bon verdict ET bonne 
     justification) ; les trois autres doivent être fausses par le verdict, par la 
     justification, ou par les deux — tout en restant plausibles, jamais absurdes.
  Inclue au moins 3 questions du style « affirmation à évaluer » décrit ci-dessus.
- Les questions doivent porter UNIQUEMENT sur des faits présents dans le texte fourni — 
  n'invente rien et ne pioche pas dans des connaissances bibliques externes au texte.
- Le champ "justification" est OBLIGATOIRE pour chaque question (ne le laisse jamais 
  vide) : il doit citer ou paraphraser précisément le passage de la leçon qui justifie 
  la bonne réponse. Un participant qui se trompe la verra affichée à côté de la bonne 
  réponse, donc elle doit se suffire à elle-même pour comprendre son erreur sans avoir 
  à relire toute la leçon.
- Le champ "question" doit être rédigé en français clair, sans ambiguïté.
- Ne mets JAMAIS le titre du test, la date/période ou une durée limite dans le JSON : 
  ces informations sont toujours saisies séparément par la personne qui importe.

FORMAT JSON EXACT À RESPECTER (le tableau de questions, rien d'autre) :
[
  { "type": "mcq", "question": "Texte de la question ?", "options": ["Option A", "Option B", "Option C", "Option D"], "correctOption": 0, "justification": "Citation ou paraphrase du passage de la leçon.", "points": 2 },
  { "type": "mcq", "question": "Le travail est-il présenté comme une malédiction dans la leçon ?", "options": ["Vrai, car le travail existait déjà avant la chute de l'homme.", "Faux, car Dieu a maudit le sol seulement après la chute de l'homme.", "Vrai, car Dieu lui-même a dit à l'homme qu'il mangerait à la sueur de son front.", "Faux, car la leçon ne mentionne jamais la malédiction du travail."], "correctOption": 3, "justification": "Le texte dit au contraire : « le travail n'est pas une malédiction, mais un devoir contractuel. »", "points": 2 }
]

Voici le contenu de la leçon :
[COLLE ICI LE TEXTE DE LA LEÇON, OU DÉCRIS L'IMAGE JOINTE]
```

## Utilisation

1. Colle ce prompt dans un chat avec Claude (ou un autre modèle acceptant les
   images), en joignant la photo/PDF de la leçon ou en collant son texte.
2. Récupère le JSON généré.
3. Dans `/admin/dashboard` → **Quiz du jour**, colle-le dans le champ
   d'import JSON (mode « JSON avancé »), ou importe-le directement comme
   fichier `.json` via le bouton **Importer un fichier JSON**. Le titre du
   quiz, la date/période et la durée limite se saisissent séparément dans le
   formulaire — ils ne font jamais partie du fichier importé.

## Tolérance de l'import (parseur, `lib/quiz-import-parser.ts`)

Le format ci-dessus est celui à viser pour un résultat prévisible, mais
l'import accepte aussi un JSON généré par une IA qui s'en écarte légèrement,
sans le rejeter :

- Le tableau de questions peut être à la racine du JSON, ou dans
  `questions`, `quiz.questions`, `items`, `data.questions`, ou toute autre
  propriété de premier niveau qui contient un tableau d'objets.
- Le texte de la question peut s'appeler `question`, `text`, `enonce`,
  `libelle`, `intitule`...
- Les options peuvent s'appeler `options`, `choices`, `propositions`,
  `reponses`, `answers`...
- La bonne réponse d'un QCM peut être donnée comme un index base 0 ou base 1,
  une lettre (A, B, C...), ou le texte exact de l'option — le parseur devine
  laquelle.
- Le type peut être absent : il est alors déduit de la forme (des options →
  QCM ; une réponse attendue seule, sans options → réponse courte ; sinon →
  question ouverte).
- Si `points` manque sur certaines questions, les points restants (pour
  atteindre 20 au total) sont répartis automatiquement entre elles plutôt que
  de rejeter le fichier.
- Si, après tout cela, le total ne fait toujours pas exactement 20, l'import
  est refusé avec un message indiquant le total obtenu.

**Important pour qui modifie le générateur ou le parseur :** ces deux
fichiers doivent rester synchronisés. Si le format canonique ci-dessus
change, mets à jour `lib/quiz-import-parser.ts` (et `lib/quiz-validation.ts`
pour la contrainte des 20 points) en conséquence, et vice-versa.
