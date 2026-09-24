# Quiz Biblique MEF

Site de quiz biblique quotidien pour la Mission Évangélique de la Foi (MEF).
Chaque jour, un quiz basé sur la leçon du jour est publié. Les participants
répondent, voient leurs résultats détaillés avec corrections, et les reçoivent
par email. Un espace admin permet de publier les quiz et de suivre les
statistiques par paroisse.

Accessible sur **quiz.mefzogbadje.org**.

## Stack technique

- [Next.js 14](https://nextjs.org/) — App Router, TypeScript
- [Supabase](https://supabase.com/) — base de données PostgreSQL
- [Resend](https://resend.com/) — envoi d'emails transactionnels
- [Vercel](https://vercel.com/) — hébergement
- [Tailwind CSS](https://tailwindcss.com/) — styles

## 1. Installation locale

```bash
npm install
cp .env.example .env
```

Renseigne les variables d'environnement dans `.env` (voir section suivante),
puis lance le serveur de développement :

```bash
npm run dev
```

L'application est accessible sur http://localhost:3000.

## 2. Variables d'environnement

| Variable | Description |
| --- | --- |
| `SUPABASE_URL` | URL du projet Supabase (Project Settings → API) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé `service_role` du projet Supabase (⚠️ secrète, ne jamais l'exposer côté client) |
| `SUPERADMIN_PASSWORD` | Mot de passe unique pour se connecter à `/admin` |
| `SESSION_SECRET` | Chaîne aléatoire longue utilisée pour signer le cookie de session admin |
| `RESEND_API_KEY` | Clé API Resend pour l'envoi d'emails |
| `RESEND_FROM_EMAIL` | Adresse d'expédition des emails (ex : `noreply@mefzogbadje.org`, doit être un domaine vérifié sur Resend) |

Génère une valeur robuste pour `SESSION_SECRET`, par exemple :

```bash
openssl rand -hex 32
```

## 3. Configuration de Supabase

1. Crée un projet sur [supabase.com](https://supabase.com).
2. Ouvre l'éditeur SQL du projet (SQL Editor) et exécute le contenu du
   fichier [`schema.sql`](./schema.sql) à la racine de ce dépôt. Cela crée
   toutes les tables nécessaires : `participants`, `daily_quizzes`,
   `daily_questions`, `daily_submissions`, `daily_answers`.
3. Récupère l'URL du projet et la clé `service_role` dans
   **Project Settings → API**, et renseigne-les dans `SUPABASE_URL` et
   `SUPABASE_SERVICE_ROLE_KEY`.

> L'application n'utilise que la clé `service_role` côté serveur (routes API
> Next.js). RLS est activé sur toutes les tables sans policy publique : aucun
> accès direct depuis le navigateur n'est possible.

## 4. Configuration de Resend

1. Crée un compte sur [resend.com](https://resend.com).
2. Vérifie le domaine `mefzogbadje.org` (ou le domaine d'envoi choisi) dans
   **Domains**.
3. Génère une clé API dans **API Keys** et renseigne-la dans
   `RESEND_API_KEY`.
4. Renseigne `RESEND_FROM_EMAIL` avec une adresse du domaine vérifié
   (ex : `noreply@mefzogbadje.org`).

## 5. Déploiement sur Vercel

1. Pousse ce dépôt sur GitHub.
2. Sur [vercel.com](https://vercel.com), importe le dépôt comme nouveau
   projet.
3. Dans **Project Settings → Environment Variables**, ajoute les 6 variables
   listées ci-dessus (Production, Preview et Development).
4. Déploie. Le build utilise `npm run build`.
5. Dans **Project Settings → Domains**, ajoute le domaine
   `quiz.mefzogbadje.org` et configure le DNS (enregistrement CNAME vers
   `cname.vercel-dns.com`, ou selon les instructions affichées par Vercel)
   chez ton registrar.

## 6. Utilisation

### Participants

- `/` — page d'accueil, affiche le quiz du jour s'il est actif.
- `/quiz` — formulaire d'identification (nom, paroisse, email, WhatsApp).
- `/quiz/[quizId]` — page du quiz (une tentative, deux si le score est
  inférieur à 60 % au premier essai).
- `/quiz/[quizId]/resultats/[token]` — résultats détaillés avec corrections
  et partage WhatsApp, via un jeton de résultat non devinable (pas l'ID de
  la soumission).

### Admin

- `/admin` — connexion avec `SUPERADMIN_PASSWORD`.
- `/admin/dashboard` — 5 onglets :
  - **Quiz du jour** : créer un quiz et importer les questions au format
    JSON (voir format ci-dessous), puis l'activer.
  - **Participants** : liste de tous les participants (email et WhatsApp
    cliquables).
  - **Résultats** : soumissions d'un quiz sélectionné.
  - **Classement général** : classement de tous les participants sur un
    quiz.
  - **Classement par paroisse** : moyenne et classement par paroisse.

### Format JSON d'import des questions

```json
[
  {
    "type": "mcq",
    "question": "Question ?",
    "options": ["A", "B", "C", "D"],
    "correctOption": 0,
    "justification": "Selon la leçon, ...",
    "points": 2
  },
  {
    "type": "true_false",
    "question": "Affirmation ?",
    "options": ["Vrai", "Faux"],
    "correctOption": 1,
    "justification": "La leçon dit que ...",
    "points": 1
  },
  {
    "type": "short",
    "question": "Question ?",
    "correctText": "réponse",
    "justification": "...",
    "points": 2
  },
  {
    "type": "open",
    "question": "Question ouverte ?",
    "justification": "",
    "points": 4
  }
]
```

Les questions de type `open` ne sont pas corrigées automatiquement (aucune
bonne réponse définie) ; elles apparaissent dans les résultats sans score
automatique.

## 7. Build de production

```bash
npm run build
npm run start
```

## Structure du projet

```
app/
  page.tsx                     # Accueil
  quiz/page.tsx                 # Identification
  quiz/[quizId]/page.tsx        # Quiz
  quiz/[quizId]/resultats/      # Résultats
  admin/page.tsx                # Connexion admin
  admin/dashboard/              # Dashboard admin
  api/                          # Routes API (participant, quiz, admin)
components/admin/               # Composants des onglets du dashboard
lib/                            # Supabase, auth, email, types
schema.sql                      # Schéma Supabase
```
