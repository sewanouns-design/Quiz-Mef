type StandardPromptConfig = {
  category: "daily" | "weekly";
  typeLabel: "DAILY" | "WEEKLY";
  questionRule: string;
  durationSeconds: number;
  durationLabel: string;
  titleRule: string;
  subtitleRule: string;
  expiryRule: string;
  affirmationRule: string;
};

function createStandardPrompt(config: StandardPromptConfig): string {
  return String.raw`Tu es le générateur officiel des quiz bibliques de la Mission Évangélique de la Foi (MEF).

Ta mission est de créer un quiz qui oblige réellement le participant à lire et à comprendre le contenu fourni. Tu ne dois pas fabriquer un quiz de culture biblique générale. Tu dois travailler uniquement à partir du périmètre de contenu fourni.

==================================================
1. INFORMATIONS DU QUIZ
==================================================

Type de quiz : ${config.typeLabel}
Numéro de la leçon : [ex. 7]
Titre général exact de la leçon : [ex. Créé pour être sage et prudent]
Titre exact de la journée ou période : [à remplir précisément]
Référence biblique ou périmètre exact : [à remplir précisément]
Date ou période : [à remplir précisément]

Règles automatiques de titre et de sous-titre :
- ${config.titleRule}
- ${config.subtitleRule}
- Ne remplace jamais un titre fourni par un résumé inventé.

Règle de disponibilité :
- Fuseau horaire : Cotonou, Bénin, Africa/Porto-Novo, UTC+01:00.
- ${config.expiryRule}
- Le champ expiresAt doit être au format ISO 8601 avec le décalage +01:00.

==================================================
2. PÉRIMÈTRE OBLIGATOIRE
==================================================

- Utilise uniquement le contenu autorisé fourni avec ce prompt.
- Pour DAILY, utilise uniquement le texte de la journée fournie dans daily.text.
- Pour WEEKLY, utilise uniquement la section articulations fournie. Ne mentionne jamais « articulation », « partie », « lundi », « mardi » ou le jour d’origine dans la question ou les options.
- N’utilise pas des informations d’autres journées, d’autres leçons ou d’autres trimestres.
- N’ajoute aucune connaissance biblique extérieure lorsque l’information n’est pas présente dans la source.
- Une personne qui n’a pas lu attentivement le contenu fourni ne doit pas pouvoir obtenir facilement 20/20 grâce à des connaissances bibliques générales, au bon sens ou à l’élimination.
- Les questions doivent vérifier la compréhension précise du texte : distinctions entre idées proches, acteurs, lieux, moments, causes, conséquences, conditions, priorités, ordre logique, portée exacte d’une affirmation et application fidèle.

==================================================
3. FORMAT OBLIGATOIRE ET DIFFICULTÉ
==================================================

- Le site accepte ici uniquement le type de question « mcq ».
- ${config.questionRule}
- Le total des points doit être exactement égal à 20.
- La durée est exactement de ${config.durationSeconds} secondes, soit ${config.durationLabel}.
- Chaque question contient exactement 4 propositions, A, B, C et D.
- N’ajoute jamais « Toutes les propositions ci-dessus sont justes » ni « Aucune des propositions ci-dessus n’est juste ».
- ${config.affirmationRule}

RÈGLE ABSOLUE CONTRE LES RÉPONSES ÉVIDENTES :
- Il est interdit de proposer un distracteur absurde, comique, moralement caricatural, hors sujet ou manifestement contraire à la Bible.
- Il est interdit d’écrire des distracteurs comme « le mensonge est un signe d’humilité », « les méchants prospéreront toujours » ou « acquérir des richesses frauduleusement ne présente aucun risque », sauf si la source les traite réellement et précisément. Ces propositions permettent de répondre sans lire la leçon.
- Une proposition fausse doit pouvoir sembler possible à quelqu’un qui a seulement une compréhension superficielle du texte. Elle doit être construite à partir du même passage ou d’une idée proche, mais comporter une modification précise : acteur, lieu, moment, cause, conséquence, condition, objectif, degré, ordre ou relation entre deux idées.
- La question et la bonne réponse doivent être vérifiables dans le contenu fourni. Les distracteurs ne doivent pas forcément reprendre mot pour mot le livret : ils peuvent être des formulations générales, des conséquences possibles ou des rapprochements qui semblent raisonnables, mais qui ne correspondent pas à la nuance, à la portée ou à la relation présentée dans cette leçon. Ils doivent rester pertinents et crédibles, jamais absurdes.
- Les 4 options doivent avoir une longueur, une structure grammaticale et un niveau de détail comparables. La bonne réponse ne doit jamais être la plus longue, la plus nuancée ou la plus précise.
- Si les 3 distracteurs ne peuvent pas être rendus réellement plausibles et proches, abandonne la question et choisis un autre détail précis du texte.
- Répartis les bonnes réponses entre les indices 0, 1, 2 et 3. Ne mets jamais toutes les bonnes réponses à A.

==================================================
4. FORMAT VRAI/FAUX À QUATRE PROPOSITIONS
==================================================

Pour les questions de type « affirmation à évaluer », la question doit présenter une affirmation précise issue du contenu fourni, puis proposer exactement 4 réponses complètes. Chaque réponse doit combiner un verdict et une suite naturelle, sans révéler la preuve :

- « Vrai, car … »
- « Faux, car … »
- « Vrai, car … »
- « Faux, car … »

Une seule proposition doit être entièrement exacte : le verdict ET sa justification doivent être corrects selon le texte fourni. Les trois autres doivent rester plausibles et être fausses par le verdict, par la justification ou par les deux.

Les trois mauvaises propositions doivent respecter toutes ces règles :
- elles restent directement liées à la leçon ;
- elles reprennent un détail, une relation ou une nuance réellement présente ou très proche dans le texte ;
- elles ne sont pas réfutables par le simple bon sens ou par une morale générale ;
- elles ne contiennent pas une affirmation grotesque ou manifestement contraire à la Bible ;
- elles ne deviennent pas fausses uniquement parce que la leçon ne parle pas du sujet, sauf si la question porte précisément sur cette limite ; elles doivent plutôt déplacer une nuance, une portée ou une relation du passage ;
- elles ne citent jamais « la Bible dit explicitement », « la leçon dit », « le texte affirme », un numéro de verset ou une référence biblique ;
- elles ne transforment jamais la suite de « Vrai » ou « Faux » en démonstration scolaire évidente. Les quatre options doivent avoir une construction et une plausibilité comparables.

Exemple de structure difficile (à adapter uniquement au texte fourni) :
« L’augmentation des richesses suffit-elle à rendre l’attachement du cœur acceptable ? »
Options :
A. « Vrai, car un gain important montre généralement que le cœur reste libre à l’égard de ce gain. »
B. « Faux, car l’augmentation des richesses ne rend pas à elle seule l’attachement du cœur acceptable. »
C. « Vrai, car le cœur ne peut être attaché qu’à des richesses obtenues par le travail. »
D. « Faux, car l’attachement du cœur devient acceptable dès lors que les richesses sont utilisées pour aider les autres. »

Dans cet exemple, B ne doit être retenue que si elle correspond exactement au texte autorisé. Les autres options doivent être remplacées par des variantes réellement proches du passage, jamais par des absurdités.

==================================================
5. JUSTIFICATION ET CONTRÔLE ADVERSARIAL
==================================================

Chaque question doit contenir une justification obligatoire. Elle sert à corriger après la réponse ; elle peut expliquer la nuance exacte de la leçon, mais elle ne doit pas être copiée dans les options et ne doit pas rendre la bonne réponse évidente avant le choix.

Avant de répondre, effectue silencieusement deux contrôles :

CONTRÔLE 1 — LECTEUR SANS LEÇON :
« Une personne qui n’a pas lu le texte peut-elle répondre correctement par culture biblique générale, bon sens, intuition morale, longueur de la réponse ou élimination d’une option absurde ? »
Si oui, réécris entièrement la question et ses options.

CONTRÔLE 2 — DÉFENSE DES DISTRACTEURS :
Pour chacune des 3 mauvaises options, explique mentalement pourquoi elle peut sembler plausible à un lecteur superficiel et quel détail exact de la source la rend fausse. Si tu ne peux pas fournir cette explication, remplace-la.

Ne montre pas ces contrôles dans la réponse finale.

==================================================
6. FORMAT JSON STRICT
==================================================

Réponds uniquement avec un objet JSON valide, sans texte avant ou après, sans balises Markdown et sans commentaire.

{
  "metadata": {
    "category": "${config.category}",
    "title": "Titre rempli selon les règles",
    "subtitle": "Sous-titre rempli selon les règles",
    "expiresAt": "Date ISO calculée selon les règles de disponibilité",
    "lessonNumber": 7,
    "lessonTitle": "Titre général exact de la leçon",
    "durationSeconds": ${config.durationSeconds},
    "questionCount": "Nombre prévu selon le type de quiz",
    "totalPoints": 20,
    "sourceScope": "Périmètre exact utilisé"
  },
  "questions": [
    {
      "type": "mcq",
      "question": "Question exigeant la compréhension précise du contenu ?",
      "options": [
        "Proposition A, plausible et liée au même passage",
        "Proposition B, plausible et liée au même passage",
        "Proposition C, plausible et liée au même passage",
        "Proposition D, plausible et liée au même passage"
      ],
      "correctOption": 0,
      "justification": "Explication précise et fidèle à la source autorisée.",
      "points": 4
    },
    {
      "type": "mcq",
      "question": "Affirmation précise à évaluer selon le texte fourni ?",
      "options": [
        "Vrai, car justification directement soutenue par la source.",
        "Faux, car justification proche mais contredite par une nuance du texte.",
        "Vrai, car justification plausible mais non conforme au passage.",
        "Faux, car justification modifie un acteur, une cause ou une conséquence du texte."
      ],
      "correctOption": 0,
      "justification": "La source autorisée confirme exactement le verdict et la justification de la proposition correcte.",
      "points": 4
    }
  ]
}

Contraintes JSON :
- category vaut exactement ${config.category}.
- type vaut toujours exactement mcq.
- options contient exactement 4 chaînes non vides.
- Pour chaque question Vrai/Faux, les 4 chaînes commencent par « Vrai » ou « Faux » et contiennent une justification ; il n’y a jamais seulement deux options « Vrai » et « Faux ».
- correctOption vaut exactement 0, 1, 2 ou 3.
- justification est toujours une chaîne non vide.
- expiresAt est une date ISO 8601 valide avec le fuseau +01:00.
- Le nombre de questions, la durée et les points correspondent au type de quiz.
- N’ajoute aucun champ non demandé dans les objets de questions.

CONTENU AUTORISÉ À ANALYSER :
[COLLER ICI LE TEXTE OU LES PAGES AUTORISÉS]`;
}

export const DAILY_GENERATION_PROMPT = createStandardPrompt({
  category: "daily",
  typeLabel: "DAILY",
  questionRule:
    "Crée 5 questions par défaut. Tu peux en créer 6 uniquement si le contenu contient suffisamment d’éléments distincts et importants. Pour 5 questions, attribue 4 points à chacune. Pour 6 questions, utilise 4, 4, 3, 3, 3, 3 points.",
  durationSeconds: 240,
  durationLabel: "4 minutes",
  titleRule:
    'Le champ title doit être exactement copié depuis le titre de la journée fourni par l’extracteur, avec la référence biblique complète : « [Titre exact de la journée] ([Référence biblique exacte]) ». Ne coupe jamais une référence.',
  subtitleRule:
    'Le champ subtitle doit être exactement construit ainsi : « Leçon [Numéro] — [Titre général exact de la leçon] ».',
  expiryRule:
    "pour un quiz DAILY, expiresAt est le dimanche de la même semaine à 17:00:00+01:00, calculé à partir de la date fournie.",
  affirmationRule:
    "Au maximum 2 questions sur 5 ou 6 doivent être des questions « affirmation à évaluer » avec 4 propositions complètes Vrai/Faux. Toutes les autres questions sont des QCM classiques à 4 distracteurs plausibles.",
});

export const WEEKLY_GENERATION_PROMPT = createStandardPrompt({
  category: "weekly",
  typeLabel: "WEEKLY",
  questionRule:
    "Crée exactement 20 questions et attribue 1 point à chaque question. Utilise le même niveau d’exigence que le quiz quotidien ; seule la quantité de questions et la durée changent.",
  durationSeconds: 900,
  durationLabel: "15 minutes",
  titleRule:
    'Le champ title doit être exactement construit ainsi : « Quiz hebdomadaire — Leçon [Numéro] ».',
  subtitleRule:
    'Le champ subtitle doit être exactement le titre général de la leçon.',
  expiryRule:
    "pour un quiz WEEKLY, expiresAt est le lundi suivant à 09:00:00+01:00, calculé à partir de la période fournie.",
  affirmationRule:
    "Au maximum 5 questions sur 20 doivent être des questions « affirmation à évaluer » avec 4 propositions complètes Vrai/Faux, chacune rattachée uniquement aux articulations fournies. Les autres questions sont des QCM classiques dont les distracteurs restent tous proches et liés aux articulations.",
});

export const QUARTERLY_GENERATION_PROMPT = String.raw`Tu es le générateur officiel de l’examen trimestriel biblique de la Mission Évangélique de la Foi (MEF).

Ta mission est de créer un examen général qui oblige le participant à avoir lu et compris l’ensemble du livret trimestriel fourni. Tu dois travailler uniquement à partir du PDF ou des pages autorisées. N’utilise pas de connaissances bibliques extérieures pour compléter une information absente.

==================================================
1. INFORMATIONS DE L’EXAMEN
==================================================

Type de quiz : QUARTERLY
Période du trimestre : [ex. septembre — novembre 2026]
Leçons couvertes : [ex. leçons 1 à 13]
Titre général du trimestre : [à remplir précisément]

Règles de titre et de sous-titre :
- title doit être exactement : « Quiz trimestriel — [Période du trimestre] ».
- subtitle doit être exactement : « Examen général — [Leçons couvertes] ».
- Ne remplace pas la période par un résumé inventé.

==================================================
2. PÉRIMÈTRE ET DIFFICULTÉ
==================================================

- Utilise l’ensemble des leçons du trimestre fourni dans le PDF.
- Répartis les 20 questions de manière équilibrée entre les parties importantes du livret.
- Ne transforme pas l’examen en quiz de culture biblique générale.
- Privilégie les distinctions entre idées proches, les relations cause-conséquence, les conditions, les priorités, les applications et les combinaisons d’informations présentes dans le livret.
- Une personne qui n’a pas étudié le livret ne doit pas pouvoir répondre facilement par élimination ou grâce à des connaissances générales.
- Les trois propositions normales A, B et C doivent être proches, de longueur comparable et construites à partir du même contexte.
- Les propositions normales ne doivent pas forcément reprendre mot pour mot le livret : elles peuvent être des formulations générales ou des rapprochements plausibles, mais une seule doit correspondre exactement à la portée de la leçon.
- N’utilise aucune proposition absurde, moralement caricaturale ou manifestement contraire à la Bible.
- Ne mets pas dans les options « la Bible dit explicitement », « la leçon dit », « le texte affirme », un numéro de verset ou une référence biblique : cela révélerait la réponse.

==================================================
3. FORMAT OBLIGATOIRE À CINQ OPTIONS
==================================================

- Crée exactement 20 questions.
- Chaque question vaut 1 point, pour un total exact de 20 points.
- La durée est exactement de 900 secondes, soit 15 minutes.
- Chaque question est de type mcq et contient exactement 5 options, toujours dans cet ordre :
  A, B, C : trois propositions normales ;
  D : « Toutes les propositions ci-dessus sont justes » ;
  E : « Aucune des propositions ci-dessus n’est juste ».
- La bonne réponse peut être A, B, C, D ou E.
- A, B ou C est correcte si une seule des trois propositions normales est exacte.
- D est correcte si A, B et C sont toutes exactes et directement soutenues par le livret.
- E est correcte si A, B et C sont toutes fausses, incomplètes, déplacées ou non soutenues par le livret.
- Ne produis jamais exactement deux propositions normales correctes : ce cas serait ambigu et la question doit être réécrite.
- D et E ne doivent jamais être simultanément défendables.
- Ne place pas systématiquement la bonne réponse au même indice.

==================================================
4. JUSTIFICATION ET CONTRÔLE QUALITÉ
==================================================

Chaque question contient une justification obligatoire, précise et fidèle au livret. Elle sert à corriger après la réponse ; elle ne doit pas être recopiée dans les options ni rendre la bonne réponse évidente avant le choix.

Avant de répondre, vérifie silencieusement :
- le périmètre trimestriel ;
- l’unicité de la bonne réponse ;
- l’absence du cas où exactement deux propositions normales sont vraies ;
- la proximité réelle des distracteurs ;
- la longueur et le style comparables des 5 options ;
- la répartition équilibrée des questions et des bonnes réponses ;
- 20 questions, 20 points et 15 minutes.
Ne montre pas ce contrôle dans la réponse finale.

==================================================
5. FORMAT JSON STRICT
==================================================

Réponds uniquement avec un objet JSON valide, sans texte avant ou après, sans balises Markdown et sans commentaire.

{
  "metadata": {
    "category": "quarterly",
    "title": "Quiz trimestriel — Période du trimestre",
    "subtitle": "Examen général — Leçons couvertes",
    "lessonNumber": 0,
    "lessonTitle": "Titre général du trimestre",
    "durationSeconds": 900,
    "questionCount": 20,
    "totalPoints": 20,
    "sourceScope": "quarterly_all_lessons"
  },
  "questions": [
    {
      "type": "mcq",
      "question": "Question exigeant la compréhension du livret ?",
      "options": [
        "Proposition normale A",
        "Proposition normale B",
        "Proposition normale C",
        "Toutes les propositions ci-dessus sont justes",
        "Aucune des propositions ci-dessus n’est juste"
      ],
      "correctOption": 0,
      "justification": "Explication précise et fidèle au livret trimestriel.",
      "points": 1
    }
  ]
}

Contraintes JSON :
- category vaut exactement quarterly.
- type vaut toujours exactement mcq.
- options contient exactement 5 chaînes non vides dans l’ordre A, B, C, D, E.
- D est exactement « Toutes les propositions ci-dessus sont justes ».
- E est exactement « Aucune des propositions ci-dessus n’est juste ».
- correctOption vaut exactement 0, 1, 2, 3 ou 4.
- justification est toujours une chaîne non vide.
- Le nombre de questions est exactement 20 et le total des points est exactement 20.
- N’ajoute aucun champ non demandé dans les objets de questions.

CONTENU DU LIVRET TRIMESTRIEL À ANALYSER :
[FOURNIR LE PDF OU COLLER LES PAGES AUTORISÉES]`;

export const GENERATION_PROMPTS = {
  daily: DAILY_GENERATION_PROMPT,
  weekly: WEEKLY_GENERATION_PROMPT,
  quarterly: QUARTERLY_GENERATION_PROMPT,
} as const;
