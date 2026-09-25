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
  address text not null,
  email text,
  whatsapp text,
  device_key text unique not null,
  created_at timestamptz default now()
);

create index if not exists idx_participants_device_key on participants (device_key);
create index if not exists idx_participants_address on participants (address);

-- ------------------------------------------------------------
-- Quiz quotidiens
-- ------------------------------------------------------------
create table if not exists daily_quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  lesson_date date not null unique,
  is_active boolean default false,
  duration_seconds int,
  -- 'overview' : toutes les questions révélées d'un coup au clic "Commencer".
  -- 'sequential' : une question à la fois, impossible de voir la suite à l'avance.
  quiz_mode text not null default 'overview' check (quiz_mode in ('overview', 'sequential')),
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
    {"icon": "📊", "title": "Reçois tes résultats", "description": "Score détaillé, corrections, et un email récapitulatif."}
  ]'::jsonb,
  verse_text text not null default 'Sonde les écritures, car ce sont elles qui rendent témoignage de moi.',
  verse_reference text not null default 'Jean 5:39',
  footer_text text not null default 'Quiz Biblique MEF — Mission Évangélique de la Foi',
  show_stats boolean not null default true,
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
-- Relances par email (24h / 48h / 72h d'inactivité depuis la
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
-- Row Level Security
-- L'application n'accède à Supabase que via la clé service_role
-- côté serveur (routes API Next.js). On active RLS sans policy
-- publique afin qu'aucun accès direct depuis le navigateur
-- (clé anon) ne soit possible.
-- ------------------------------------------------------------
alter table participants enable row level security;
alter table daily_quizzes enable row level security;
alter table daily_questions enable row level security;
alter table daily_submissions enable row level security;
alter table daily_answers enable row level security;
alter table site_settings enable row level security;
alter table login_attempts enable row level security;
alter table rate_limit_events enable row level security;
alter table reengagement_reminders enable row level security;
