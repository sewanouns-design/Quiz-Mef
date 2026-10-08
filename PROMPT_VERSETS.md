# Prompt de reformatage de la banque de versets

À copier-coller dans un chat IA (Claude, ChatGPT...) avec ta propre banque de
versets (dans n'importe quel format), pour la reformater automatiquement au
format attendu par l'import en masse de l'admin (`/admin/dashboard` → onglet
**Trouve le verset** → "Importer plusieurs versets en une fois").

```
Tu es un outil de reformatage pour le site "Quiz Biblique MEF".

Je vais te fournir une banque de versets bibliques, dans N'IMPORTE QUEL format
(liste, tableau, texte libre, numéroté, avec ou sans mot à deviner...).

Ta tâche : la retranscrire EXACTEMENT, verset par verset, dans le format
strict ci-dessous, sans changer le texte des versets ni les références, sans
en ajouter, sans en retirer, sans en reformuler.

RÈGLES :
- Réponds UNIQUEMENT avec la liste reformatée, une ligne par verset, sans
  texte avant/après, sans numérotation, sans balises markdown.
- Chaque ligne respecte EXACTEMENT ce format, séparé par " | " (espace-pipe-espace) :
  Référence | Texte complet du verset | Mot à deviner (facultatif)
- "Référence" : garde-la telle que fournie, ou remets-la au format court
  habituel si elle était donnée autrement (ex. "Jean 3.16" ou "Jean chapitre 3
  verset 16" → "Jean 3:16").
- "Texte complet du verset" : copie le texte source tel quel (orthographe,
  accents, ponctuation) — ne corrige, ne complète et ne raccourcis rien. Si
  le texte source est entouré de guillemets ou de [notes], retire-les, mais
  ne touche pas au texte lui-même.
- "Mot à deviner" (3e champ) :
  - Si la source propose déjà un mot/une expression à deviner, remets-le
    EXACTEMENT comme sous-chaîne du texte du 2e champ (même orthographe,
    mêmes accents, même casse).
  - Si la source n'en propose pas, laisse ce champ vide (ne l'invente pas).
- Une ligne par verset, dans le même ordre que la source.
- Si une ligne de la source est incomplète ou ambiguë (référence ou texte
  manquant), ignore-la silencieusement plutôt que d'inventer le manquant.

Voici la banque de versets à reformater :
[COLLE ICI TA BANQUE DE VERSETS, DANS N'IMPORTE QUEL FORMAT]
```

## Utilisation

1. Colle ce prompt dans un chat avec une IA, en remplaçant la dernière ligne
   par ta propre banque de versets (peu importe son format d'origine).
2. Récupère la liste reformatée.
3. Dans `/admin/dashboard` → **Trouve le verset**, colle-la directement dans
   le champ "Importer plusieurs versets en une fois", puis clique sur
   **Importer tout**.

Le format ciblé est le même que celui attendu par
`app/api/admin/verses/bulk/route.ts` : une ligne par verset, `Référence |
Texte | Mot à deviner (facultatif)`. Si ce format change côté import, mets à
jour ce prompt en conséquence.
