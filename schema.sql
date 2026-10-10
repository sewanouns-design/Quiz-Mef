-- ============================================================
-- Quiz Biblique MEF — Schéma Supabase
-- À exécuter dans l'éditeur SQL de Supabase (SQL Editor)
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Participants
-- ------------------------------------------------------------
create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  -- Identifiant principal d'une personne (normalisé en minuscules à
  -- l'écriture). Si un email déjà connu est soumis depuis un nouvel
  -- appareil, l'API rattache cet appareil à la fiche existante (fusion)
  -- au lieu de créer un doublon, ce qui uniformise le nom affiché.
  email text,
  whatsapp text,
  device_key text unique not null,
  -- Opt-in explicite : n'apparaît dans le classement public (prénom +
  -- initiale seulement) que si activé au moment de l'identification.
  show_in_leaderboard boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists idx_participants_device_key on participants (device_key);
create index if not exists idx_participants_address on participants (address);
create unique index if not exists idx_participants_email_unique
  on participants (email)
  where email is not null;

-- ------------------------------------------------------------
-- Jetons de connexion ("lien magique") : reconnaître un participant sur un
-- nouvel appareil/navigateur sans compte ni mot de passe. Jeton à usage
-- unique, expirant, envoyé par email sur demande explicite (/quiz).
-- Consommer le jeton réécrit le device_key d'origine du participant dans
-- le localStorage du nouvel appareil.
-- ------------------------------------------------------------
create table if not exists participant_login_tokens (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid references participants(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_participant_login_tokens_token on participant_login_tokens (token);
create index if not exists idx_participant_login_tokens_participant_id on participant_login_tokens (participant_id);

-- ------------------------------------------------------------
-- Quiz quotidiens
-- ------------------------------------------------------------
create table if not exists daily_quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  -- Contexte court affiché sous le titre (page d'accueil, pop-up du quiz
  -- hebdo, écran de départ du quiz). Optionnel.
  subtitle text,
  is_active boolean default false,
  duration_seconds int,
  -- Échéance optionnelle : passé ce moment, le quiz n'apparaît plus comme
  -- disponible pour les participants (page d'accueil, sélecteur de quiz),
  -- même si is_active reste à true — l'admin n'a pas besoin de penser à le
  -- désactiver manuellement. Un lien direct déjà obtenu continue de
  -- fonctionner (comme pour is_active=false), seule la découverte est filtrée.
  expires_at timestamptz,
  -- 'overview' : toutes les questions révélées d'un coup au clic "Commencer".
  -- 'sequential' : une question à la fois, impossible de voir la suite à l'avance.
  quiz_mode text not null default 'overview' check (quiz_mode in ('overview', 'sequential')),
  -- 'daily' : quiz du jour habituel. 'weekly' : récap de la semaine, mis en
  -- avant par un pop-up dédié sur la page d'accueil. Plusieurs quiz (de
  -- n'importe quelle catégorie) peuvent être actifs en même temps — activer
  -- un quiz ne désactive plus automatiquement les autres.
  category text not null default 'daily' check (category in ('daily', 'weekly')),
  created_at timestamptz default now()
);

create index if not exists idx_daily_quizzes_is_active on daily_quizzes (is_active);

-- ------------------------------------------------------------
-- Questions
-- ------------------------------------------------------------
create table if not exists daily_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references daily_quizzes(id) on delete cascade,
  type text not null, -- mcq, true_false, short, fill_blank, open
  question text not null,
  options jsonb,
  correct_option int,
  correct_text text,
  justification text,
  points int not null,
  position int not null
);

create index if not exists idx_daily_questions_quiz_id on daily_questions (quiz_id);

-- ------------------------------------------------------------
-- Soumissions
-- ------------------------------------------------------------
create table if not exists daily_submissions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references daily_quizzes(id),
  participant_id uuid references participants(id),
  score int not null,
  max_score int not null,
  cancelled boolean not null default false,
  cancel_reason text,
  -- 1 = premier essai. Une 2e tentative (attempt_number = 2) n'est autorisée
  -- que si le 1er essai n'a pas atteint 60% (voir app/api/quiz/[quizId]/submit).
  attempt_number int not null default 1,
  -- Score des questions ouvertes, saisi manuellement, distinct du score
  -- auto-corrigé (QCM/réponse courte) ci-dessus. Nul tant que non corrigé.
  open_score int,
  -- Jeton non devinable pour le lien de résultat individuel (voir
  -- app/api/quiz/[quizId]/results/[token]).
  result_token text not null,
  -- Nom normalisé (casse/espaces/Unicode) pour empêcher qu'une même personne
  -- soumette deux fois sous un nom légèrement différent.
  normalized_name text not null,
  submitted_at timestamptz default now()
);

-- Index partiels (where not cancelled) : une tentative annulée (sortie de
-- page répétée, appel entrant...) n'occupe pas définitivement un numéro de
-- tentative et ne bloque donc jamais un nouvel essai réel.
create unique index if not exists idx_unique_submission_per_attempt
  on daily_submissions (quiz_id, participant_id, attempt_number)
  where not cancelled;

create unique index if not exists idx_unique_submission_per_name_attempt
  on daily_submissions (quiz_id, normalized_name, attempt_number)
  where not cancelled;

create unique index if not exists idx_unique_result_token on daily_submissions (result_token);

create index if not exists idx_daily_submissions_quiz_id on daily_submissions (quiz_id);
create index if not exists idx_daily_submissions_participant_id on daily_submissions (participant_id);

-- ------------------------------------------------------------
-- Réponses
-- ------------------------------------------------------------
create table if not exists daily_answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references daily_submissions(id) on delete cascade,
  -- on delete set null : permet de modifier/supprimer des questions d'un quiz
  -- déjà soumis sans bloquer sur les réponses existantes.
  question_id uuid references daily_questions(id) on delete set null,
  selected_option int,
  answer_text text,
  is_correct boolean,
  points_awarded int
);

create index if not exists idx_daily_answers_submission_id on daily_answers (submission_id);
create index if not exists idx_daily_answers_question_id on daily_answers (question_id);

-- ------------------------------------------------------------
-- Questions posées par les participants sur la leçon du jour
-- ------------------------------------------------------------
create table if not exists lesson_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid references daily_quizzes(id) on delete cascade,
  participant_id uuid references participants(id),
  question_text text not null,
  created_at timestamptz default now()
);

create index if not exists idx_lesson_questions_quiz_id on lesson_questions (quiz_id);
create index if not exists idx_lesson_questions_participant_id on lesson_questions (participant_id);

-- ------------------------------------------------------------
-- Fil de discussion sur une question de leçon : réponse de l'admin,
-- puis éventuels échanges ("sender" = 'admin' ou 'participant').
-- Le message initial du participant reste dans lesson_questions.question_text ;
-- tout ce qui suit (réponse admin, relance du participant...) vit ici,
-- affiché côté participant sur la page de résultats du quiz concerné.
-- ------------------------------------------------------------
create table if not exists lesson_question_replies (
  id uuid primary key default gen_random_uuid(),
  lesson_question_id uuid references lesson_questions(id) on delete cascade,
  sender text not null check (sender in ('admin', 'participant')),
  message text not null,
  created_at timestamptz default now()
);

create index if not exists idx_lesson_question_replies_question_id
  on lesson_question_replies (lesson_question_id);

-- ------------------------------------------------------------
-- Suggestions d'amélioration du site envoyées par les participants
-- (onglet admin "Suggestions").
-- ------------------------------------------------------------
create table if not exists suggestions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid references participants(id) on delete set null,
  message text not null,
  -- L'admin peut cocher "pris en compte" sans forcément écrire de réponse,
  -- et/ou laisser une réponse libre : les deux sont affichés au
  -- participant sur sa page de résultats.
  acknowledged boolean not null default false,
  admin_response text,
  responded_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_suggestions_created_at on suggestions (created_at desc);

-- ------------------------------------------------------------
-- Paramètres du site (page d'accueil personnalisable)
-- Ligne unique ("default") mise à jour depuis l'admin.
-- ------------------------------------------------------------
create table if not exists site_settings (
  id text primary key default 'default',
  template text not null default 'steps',
  color_primary text not null default '#14213d',
  color_primary_light text not null default '#2c4570',
  color_primary_dark text not null default '#0a1428',
  color_accent text not null default '#0d9488',
  color_accent_light text not null default '#2dd4bf',
  color_accent_dark text not null default '#0f766e',
  color_secondary text not null default '#2563eb',
  color_secondary_light text not null default '#60a5fa',
  color_secondary_dark text not null default '#1d4ed8',
  color_background text not null default '#f7f6f2',
  color_text text not null default '#374151',
  font_family text not null default 'Inter',
  logo_icon text not null default '⁉️',
  hero_title text not null default 'Quiz Biblique du Jour',
  hero_subtitle text not null default 'Teste tes connaissances sur la leçon du jour',
  steps jsonb not null default '[
    {"icon": "📝", "title": "Identifie-toi", "description": "Ton nom et ton adresse suffisent pour commencer."},
    {"icon": "⁉️", "title": "Réponds au quiz", "description": "Des questions sur la leçon du jour, à ton rythme."},
    {"icon": "📊", "title": "Reçois tes résultats", "description": "Score détaillé et corrections affichés immédiatement."}
  ]'::jsonb,
  verse_text text not null default 'Sonde les écritures, car ce sont elles qui rendent témoignage de moi.',
  verse_reference text not null default 'Jean 5:39',
  footer_text text not null default 'Quiz Biblique MEF — Mission Évangélique de la Foi',
  show_stats boolean not null default true,
  -- Nom affiché dans la barre d'entête sticky de la page d'accueil (et sur
  -- les autres pages via SiteHeader).
  site_name text not null default 'Quiz Biblique',
  start_button_text text not null default 'Commencer le quiz',
  stat_label_participants text not null default 'Participants',
  stat_label_quizzes text not null default 'Quiz créés',
  stat_label_submissions text not null default 'Quiz complétés',
  -- Bandeau défilant : "{prénom} {activity_ticker_phrase} « {titre du quiz} »".
  activity_ticker_phrase text not null default 'vient de passer le quiz',
  -- Accueil personnalisé pour un appareil reconnu : "{returning_greeting}, {prénom}".
  returning_greeting text not null default 'Content de te revoir',
  -- Taille du titre/sous-titre de la page d'accueil.
  text_size text not null default 'normal' check (text_size in ('normal', 'large', 'xlarge')),
  -- Texte affiché sur la page "À propos" (menu du site).
  about_text text not null default 'Quiz Biblique est un espace proposé par la Mission Évangélique de la Foi (MEF) pour permettre à chacun de tester et d''approfondir ses connaissances de la Parole de Dieu, de façon simple et conviviale. Un nouveau quiz est proposé chaque jour, avec des questions issues de la leçon du moment — seul ou en famille, à ton rythme.',
  -- "Trouve le verset" : l'admin peut désactiver le jeu entièrement, et/ou
  -- le limiter à un créneau horaire (verse_game_schedule_enabled) borné par
  -- verse_game_schedule_start/_end — les deux colonnes de créneau restent
  -- ignorées si le créneau n'est pas activé.
  verse_game_enabled boolean not null default true,
  verse_game_schedule_enabled boolean not null default false,
  verse_game_schedule_start timestamptz,
  verse_game_schedule_end timestamptz,
  -- Chrono par question (optionnel) : si activé, chaque question du jeu
  -- doit être répondue dans verse_game_timer_seconds, sinon elle est
  -- comptée comme fausse et la bonne réponse est révélée.
  verse_game_timer_enabled boolean not null default false,
  verse_game_timer_seconds integer not null default 20 check (verse_game_timer_seconds between 3 and 300),
  -- Partage du quiz : par défaut, le message partagé (WhatsApp/natif) pointe
  -- vers l'accueil du site plutôt que directement vers le quiz joué — activer
  -- ce champ pour revenir au lien direct vers le quiz.
  quiz_share_direct_link_enabled boolean not null default false,
  updated_at timestamptz default now()
);

insert into site_settings (id) values ('default') on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Tentatives de connexion admin (protection anti brute-force)
-- ------------------------------------------------------------
create table if not exists login_attempts (
  id uuid primary key default gen_random_uuid(),
  ip text not null,
  success boolean not null,
  created_at timestamptz default now()
);

create index if not exists idx_login_attempts_ip_time on login_attempts (ip, created_at);

-- ------------------------------------------------------------
-- Limitation de débit générique pour les routes publiques
-- d'écriture (inscription, soumission de quiz, question sur la
-- leçon) : empêche le spam et l'utilisation du site comme relais
-- d'envoi d'emails non sollicités.
-- ------------------------------------------------------------
create table if not exists rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  ip text not null,
  route text not null,
  created_at timestamptz default now()
);

create index if not exists idx_rate_limit_events_ip_route_time
  on rate_limit_events (ip, route, created_at);

-- ------------------------------------------------------------
-- Relances par email (48h / 72h / 96h d'inactivité depuis la
-- dernière soumission d'un participant, cf. app/api/cron/reengagement).
-- Une ligne par (participant, soumission de référence, palier) : garantit
-- qu'un même palier n'est jamais renvoyé deux fois pour la même période
-- d'inactivité, et que le compteur repart naturellement à chaque nouvelle
-- soumission (nouveau submission_id).
-- ------------------------------------------------------------
create table if not exists reengagement_reminders (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid references participants(id) on delete cascade,
  submission_id uuid references daily_submissions(id) on delete cascade,
  milestone_hours int not null,
  sent_at timestamptz default now()
);

create unique index if not exists idx_unique_reengagement_reminder
  on reengagement_reminders (participant_id, submission_id, milestone_hours);

-- ------------------------------------------------------------
-- Abonnements aux notifications push web (rappel quotidien du quiz,
-- opt-in). Une ligne par navigateur/appareil abonné ; endpoint unique
-- fourni par le navigateur (PushSubscription.endpoint).
-- ------------------------------------------------------------
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid references participants(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

create index if not exists idx_push_subscriptions_participant_id on push_subscriptions (participant_id);

-- ------------------------------------------------------------
-- Journal d'activité admin : trace des actions destructrices/notables du
-- super-admin (suppression de résultat/participant, fusion, quiz
-- créé/modifié/supprimé/activé/désactivé/recalculé, paramètres modifiés),
-- affichées avec les soumissions dans "Activité récente" (Vue d'ensemble).
-- ------------------------------------------------------------
create table if not exists admin_activity_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  summary text not null,
  metadata jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_admin_activity_log_created_at on admin_activity_log (created_at desc);

-- ------------------------------------------------------------
-- Jeu "Trouve le verset" : banque de versets réutilisée pour deux types de
-- questions (deviner la référence / compléter le texte), jouable à tout
-- moment, indépendamment du quiz du jour.
-- ------------------------------------------------------------
create table if not exists bible_verses (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  text text not null,
  -- Mot ou expression exacte (sous-chaîne de `text`) à faire deviner pour la
  -- variante "complète le texte". Facultatif : sans ça, le verset n'est
  -- utilisé que pour la variante "devine la référence".
  blank_word text,
  -- Ancien champ à 3 paliers, conservé pour ne pas perdre de données mais
  -- plus utilisé par le jeu depuis l'introduction de `level` (100 paliers).
  difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  -- Niveau 1 à 100 : 1 = le plus facile (texte court), 100 = le plus
  -- difficile (texte long). Calculé automatiquement si l'admin ne le
  -- renseigne pas — voir lib/verse-level.ts pour les seuils de longueur.
  level smallint check (level between 1 and 100),
  created_at timestamptz default now()
);

create index if not exists idx_bible_verses_created_at on bible_verses (created_at);
create index if not exists idx_bible_verses_level on bible_verses (level);

-- Tirage aléatoire indépendant de la taille de la table (voir
-- app/api/verse-game/questions/route.ts) : une requête Supabase classique
-- plafonne à 1000 lignes, ce qui ne pioche pas vraiment dans l'ensemble
-- d'une banque de plusieurs dizaines de milliers de versets.
create or replace function get_random_bible_verses(limit_count int)
returns setof bible_verses
language sql
stable
as $$
  select * from bible_verses order by random() limit limit_count;
$$;

-- Même principe, mais limité à un niveau précis (1-100) : c'est la fonction
-- utilisée pour construire les questions d'une partie, chaque niveau étant
-- joué séparément (voir verse_game_progress plus bas).
create or replace function get_random_bible_verses_by_level(lvl int, limit_count int)
returns setof bible_verses
language sql
stable
as $$
  select * from bible_verses where level = lvl order by random() limit limit_count;
$$;

-- ------------------------------------------------------------
-- Statistiques réelles de réussite par verset, alimentées à chaque fin de
-- niveau (voir /api/verse-game/level-complete) : la vraie mesure de
-- difficulté n'est pas la longueur du texte (un verset court peut être
-- bien plus dur à deviner qu'un long) mais le taux d'échec réel des
-- joueurs sur CE verset précis.
-- ------------------------------------------------------------
create table if not exists bible_verse_stats (
  verse_id uuid primary key references bible_verses(id) on delete cascade,
  correct_count int not null default 0,
  incorrect_count int not null default 0,
  updated_at timestamptz not null default now()
);

-- Versets très connus (catéchisme, versets "d'affiche") — toujours classés
-- faciles (niveaux 1-25) quelle que soit leur longueur ou leur taux
-- d'échec réel : copie SQL de POPULAR_VERSE_REFERENCES (lib/verse-level.ts),
-- à garder synchronisée avec ce fichier si la liste évolue.
create or replace function is_popular_verse_reference(ref text)
returns boolean
language sql
immutable
as $$
  select ref = any(array[
    'Genèse 1:1','Genèse 1:27','Exode 20:3','Exode 20:12','Exode 20:13','Exode 20:14','Exode 20:15',
    'Lévitique 19:18','Nombres 6:24','Nombres 6:25','Nombres 6:26','Deutéronome 6:4','Deutéronome 6:5',
    'Deutéronome 31:6','Deutéronome 31:8','Josué 1:9','Josué 24:15','1 Samuel 16:7','2 Samuel 22:2',
    'Psaumes 1:1','Psaumes 8:1','Psaumes 19:1','Psaumes 23:1','Psaumes 23:4','Psaumes 27:1','Psaumes 34:8',
    'Psaumes 37:4','Psaumes 46:1','Psaumes 51:10','Psaumes 55:22','Psaumes 62:1','Psaumes 90:1','Psaumes 91:1',
    'Psaumes 100:1','Psaumes 103:1','Psaumes 118:24','Psaumes 119:105','Psaumes 121:1','Psaumes 121:2',
    'Psaumes 126:5','Psaumes 139:14','Psaumes 150:6','Proverbes 1:7','Proverbes 3:5','Proverbes 3:6',
    'Proverbes 16:3','Proverbes 17:17','Proverbes 22:6','Proverbes 31:30','Ecclésiaste 3:1',
    'Cantique des Cantiques 2:1','Ésaïe 9:6','Ésaïe 40:31','Ésaïe 41:10','Ésaïe 53:5','Ésaïe 55:8','Ésaïe 55:9',
    'Jérémie 17:7','Jérémie 29:11','Jérémie 33:3','Lamentations de Jérémie 3:22','Lamentations de Jérémie 3:23',
    'Ézéchiel 36:26','Daniel 3:17','Joël 2:25','Michée 6:8','Habacuc 2:4','Sophonie 3:17','Malachie 3:10',
    'Matthieu 5:3','Matthieu 5:9','Matthieu 5:14','Matthieu 6:9','Matthieu 6:33','Matthieu 6:34','Matthieu 7:7',
    'Matthieu 7:12','Matthieu 11:28','Matthieu 18:20','Matthieu 19:26','Matthieu 22:37','Matthieu 22:39',
    'Matthieu 28:19','Matthieu 28:20','Marc 10:27','Marc 11:24','Marc 12:30','Marc 16:15','Luc 1:37','Luc 2:10',
    'Luc 2:11','Luc 6:31','Luc 11:9','Luc 15:7','Luc 19:10','Jean 1:1','Jean 1:12','Jean 1:14','Jean 3:3',
    'Jean 3:16','Jean 4:24','Jean 6:35','Jean 8:12','Jean 8:32','Jean 10:10','Jean 10:11','Jean 11:25',
    'Jean 13:34','Jean 13:35','Jean 14:1','Jean 14:6','Jean 14:27','Jean 15:5','Jean 15:13','Jean 16:33',
    'Jean 20:29','Actes 1:8','Actes 2:38','Actes 4:12','Actes 16:31','Actes 20:35','Romains 1:16',
    'Romains 3:23','Romains 5:1','Romains 5:8','Romains 6:23','Romains 8:1','Romains 8:28','Romains 8:31',
    'Romains 8:38','Romains 8:39','Romains 10:9','Romains 10:13','Romains 12:1','Romains 12:2','Romains 15:13',
    '1 Corinthiens 10:13','1 Corinthiens 10:31','1 Corinthiens 13:4','1 Corinthiens 13:13','1 Corinthiens 15:57',
    '2 Corinthiens 5:7','2 Corinthiens 5:17','2 Corinthiens 9:7','2 Corinthiens 12:9','Galates 2:20',
    'Galates 5:1','Galates 5:22','Galates 5:23','Galates 6:9','Éphésiens 2:8','Éphésiens 2:9','Éphésiens 2:10',
    'Éphésiens 4:32','Éphésiens 5:25','Éphésiens 6:10','Éphésiens 6:11','Philippiens 1:6','Philippiens 1:21',
    'Philippiens 2:3','Philippiens 3:14','Philippiens 4:4','Philippiens 4:6','Philippiens 4:7','Philippiens 4:8',
    'Philippiens 4:13','Philippiens 4:19','Colossiens 3:2','Colossiens 3:15','Colossiens 3:23',
    '1 Thessaloniciens 5:16','1 Thessaloniciens 5:17','1 Thessaloniciens 5:18','2 Thessaloniciens 3:3',
    '1 Timothée 4:12','2 Timothée 1:7','2 Timothée 3:16','2 Timothée 4:7','Tite 2:11','Hébreux 4:12',
    'Hébreux 4:16','Hébreux 11:1','Hébreux 11:6','Hébreux 12:1','Hébreux 13:5','Hébreux 13:8','Jacques 1:2',
    'Jacques 1:5','Jacques 1:17','Jacques 1:22','Jacques 4:7','Jacques 4:8','1 Pierre 1:3','1 Pierre 2:9',
    '1 Pierre 3:15','1 Pierre 4:8','1 Pierre 5:7','2 Pierre 1:3','2 Pierre 3:9','1 Jean 1:9','1 Jean 3:1',
    '1 Jean 4:7','1 Jean 4:8','1 Jean 4:18','1 Jean 4:19','1 Jean 5:4','Apocalypse 1:8','Apocalypse 3:20',
    'Apocalypse 21:4','Apocalypse 22:13'
  ]);
$$;

-- Listes de noms/généalogies/formules d'attribution de parole — toujours
-- classées difficiles (niveaux 85-100) : copie SQL de la détection faite en
-- JS (hasObscureNameDensity, lib/verse-level.ts), à garder synchronisée.
create or replace function is_hard_verse_pattern(vtext text)
returns boolean
language plpgsql
immutable
as $$
declare
  common_names text[] := array['Dieu','Seigneur','Éternel','Jésus','Jésus-Christ','Christ','Esprit','Israël','Juda','Jérusalem','Sion','Égypte','Moïse','Abraham','Isaac','Jacob','David','Salomon','Pierre','Paul','Jean','Jacques','Marie','Adam','Noé','Satan','Galilée','Judée','Samarie','Babylone','Rome','Éphraïm','Benjamin','Lévi','Aaron','Josué','Samuel','Saül','Élie','Élisée','Ésaïe','Jérémie','Daniel','Ézéchiel','Ève','Pharaon'];
  stop_words text[] := array['Je','Tu','Il','Elle','Nous','Vous','Ils','Elles','On','Ce','Cette','Ces','Cet','Celui','Celle','Ceux','Celles','Mon','Ma','Mes','Ton','Ta','Tes','Son','Sa','Ses','Notre','Nos','Votre','Vos','Leur','Leurs','Qui','Que','Quoi','Dont','Où','Comment','Pourquoi','Ainsi','Alors','Or','Mais','Et','Car','Donc','Puis','Voici','Voilà','Eh','Ah','Oh','Ô','Un','Une','Les','La','Le','Des','Du','De','En','Si','Comme','Lorsque','Après','Avant','Pendant','Depuis','Afin','Tout','Tous','Toute','Toutes','Chacun','Chaque','Rien','Personne','Aucun','Quelque','Quelques','Plusieurs','Même','Aussi','Encore','Déjà','Jamais','Toujours','Bientôt','Maintenant','Ici','Là','Oui','Non','Certes'];
  words text[];
  w text;
  clean text;
  after_boundary boolean;
  cap_count int;
begin
  if length(vtext) >= 90 then
    return false;
  end if;
  if vtext ~* '(l.?éternel|dieu)\b.{0,40}\b(parla|parle|dit)\b.{0,12}à\b' then
    return true;
  end if;
  if vtext ~* '\bengendra\b' then
    return true;
  end if;
  words := regexp_split_to_array(vtext, '\s+');
  after_boundary := true;
  cap_count := 0;
  for i in 1 .. array_length(words, 1) loop
    w := words[i];
    clean := regexp_replace(w, '^[«"''(]+|[,.;:!?»")]+$', '', 'g');
    if clean ~ '^[A-ZÀ-Ý]' and not after_boundary
       and clean <> all(common_names) and clean <> all(stop_words) then
      cap_count := cap_count + 1;
    end if;
    after_boundary := (w ~ '[.!?:;]["''»)]*$');
  end loop;
  return cap_count >= 2;
end;
$$;

-- Recalcule bible_verses.level à partir du taux d'échec réel, pour tous
-- les versets "moyens" (ni populaires, ni listes de noms — ces deux
-- catégories gardent toujours leur bande dédiée) ayant assez de réponses
-- enregistrées (min_samples) ; les autres gardent leur niveau actuel.
-- ntile(54) + 25 reste à l'intérieur de la bande moyenne (26-79) : le taux
-- d'échec réel affine la difficulté perçue sans jamais faire régresser le
-- classement vers le défaut par longueur qui posait problème (voir
-- lib/verse-level.ts). Déclenché depuis l'admin (onglet "Trouve le verset").
create or replace function recalculate_verse_levels_by_difficulty(min_samples int default 5)
returns int
language plpgsql
as $$
declare
  updated_count int;
begin
  with eligible as (
    select
      s.verse_id,
      s.incorrect_count::numeric / (s.correct_count + s.incorrect_count) as error_rate
    from bible_verse_stats s
    join bible_verses v on v.id = s.verse_id
    where (s.correct_count + s.incorrect_count) >= min_samples
      and not is_popular_verse_reference(v.reference)
      and not is_hard_verse_pattern(v.text)
  ),
  ranked as (
    select verse_id, ntile(54) over (order by error_rate asc, verse_id) + 25 as new_level
    from eligible
  )
  update bible_verses
  set level = ranked.new_level
  from ranked
  where bible_verses.id = ranked.verse_id;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

-- ------------------------------------------------------------
-- Meilleur score d'UNE partie (8 questions) de "Trouve le verset", par
-- appareil — conservé pour compatibilité, mais le classement public se base
-- désormais sur verse_game_progress.total_points (cumul sur tous les
-- niveaux), plus représentatif de la progression réelle.
-- ------------------------------------------------------------
create table if not exists verse_game_scores (
  id uuid primary key default gen_random_uuid(),
  device_key text not null unique,
  best_score int not null,
  total_questions int not null,
  games_played int not null default 1,
  updated_at timestamptz default now()
);

create index if not exists idx_verse_game_scores_best_score on verse_game_scores (best_score desc);

-- ------------------------------------------------------------
-- Progression par appareil dans "Trouve le verset" : niveau le plus haut
-- débloqué (on commence au niveau 1, jusqu'à 100) et points cumulés au fil
-- des niveaux réussis. Comme verse_game_scores, volontairement sans FK vers
-- participants : jouer ne nécessite aucune identification.
-- ------------------------------------------------------------
create table if not exists verse_game_progress (
  id uuid primary key default gen_random_uuid(),
  device_key text not null unique,
  current_level int not null default 1 check (current_level between 1 and 100),
  total_points int not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists idx_verse_game_progress_points on verse_game_progress (total_points desc);

-- ------------------------------------------------------------
-- Fil d'évènements "niveau débloqué", pour des notifications flottantes
-- façon likes de live TikTok/Facebook (voir /api/verse-game/activity et
-- components du jeu). Une ligne par passage de niveau ; le nom n'est
-- résolu qu'à la lecture, et seulement pour les participants ayant activé
-- "Afficher mon prénom dans le classement".
-- ------------------------------------------------------------
create table if not exists verse_game_activity (
  id uuid primary key default gen_random_uuid(),
  device_key text not null,
  level int not null,
  -- Rang (classement par points cumulés) au moment de l'évènement, pour que
  -- la notification flottante affiche "1er/2e/3e..." plutôt qu'un simple
  -- ordre d'arrivée.
  rank int,
  -- Points gagnés sur cette partie, et si elle a fait passer au niveau
  -- suivant (false = gain de points sans passage de niveau, ex. en
  -- rejouant un niveau déjà réussi) — distingue les deux types de
  -- notification flottante affichés côté client.
  points_earned int,
  leveled_up boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_verse_game_activity_created_at on verse_game_activity (created_at desc);

-- ------------------------------------------------------------
-- Nouveautés du site, affichées brièvement (pop-up fermable) aux visiteurs
-- lors de leur première connexion après publication. Pas de ciblage par
-- appareil côté serveur : chaque navigateur retient localement l'id de la
-- dernière nouveauté vue (localStorage) pour savoir lesquelles sont
-- nouvelles pour lui.
-- ------------------------------------------------------------
create table if not exists site_updates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  -- Emoji/icône affiché dans le badge carré du pop-up "nouveauté" (voir
  -- components/home/NewsPopup.tsx).
  icon text not null default '🆕',
  link_href text,
  link_label text,
  created_at timestamptz not null default now()
);

create index if not exists idx_site_updates_created_at on site_updates (created_at desc);

-- ------------------------------------------------------------
-- Row Level Security
-- L'application n'accède à Supabase que via la clé service_role
-- côté serveur (routes API Next.js). On active RLS sans policy
-- publique afin qu'aucun accès direct depuis le navigateur
-- (clé anon) ne soit possible.
-- ------------------------------------------------------------
alter table participants enable row level security;
alter table participant_login_tokens enable row level security;
alter table daily_quizzes enable row level security;
alter table daily_questions enable row level security;
alter table daily_submissions enable row level security;
alter table daily_answers enable row level security;
alter table site_settings enable row level security;
alter table login_attempts enable row level security;
alter table rate_limit_events enable row level security;
alter table reengagement_reminders enable row level security;
alter table admin_activity_log enable row level security;
alter table push_subscriptions enable row level security;
alter table bible_verses enable row level security;
alter table verse_game_scores enable row level security;
alter table verse_game_progress enable row level security;
alter table verse_game_activity enable row level security;
alter table bible_verse_stats enable row level security;
alter table site_updates enable row level security;
