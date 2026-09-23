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
  parish text not null,
  email text,
  whatsapp text,
  device_key text unique not null,
  created_at timestamptz default now()
);

create index if not exists idx_participants_device_key on participants (device_key);
create index if not exists idx_participants_parish on participants (parish);

-- ------------------------------------------------------------
-- Quiz quotidiens
-- ------------------------------------------------------------
create table if not exists daily_quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  lesson_date date not null unique,
  is_active boolean default false,
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
  submitted_at timestamptz default now()
);

create unique index if not exists idx_unique_submission_per_participant
  on daily_submissions (quiz_id, participant_id);

create index if not exists idx_daily_submissions_quiz_id on daily_submissions (quiz_id);
create index if not exists idx_daily_submissions_participant_id on daily_submissions (participant_id);

-- ------------------------------------------------------------
-- Réponses
-- ------------------------------------------------------------
create table if not exists daily_answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references daily_submissions(id) on delete cascade,
  question_id uuid references daily_questions(id),
  selected_option int,
  answer_text text,
  is_correct boolean,
  points_awarded int
);

create index if not exists idx_daily_answers_submission_id on daily_answers (submission_id);
create index if not exists idx_daily_answers_question_id on daily_answers (question_id);

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
