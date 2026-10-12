import { getSupabaseAdmin } from "./supabase";

export interface QuarterlyCompetitionConfig {
  id: string;
  title: string;
  period_start: string;
  period_end: string;
  final_quiz_id: string;
  winner_count: number;
  final_quiz?: { id: string; title: string; category: string } | { id: string; title: string; category: string }[] | null;
}

export interface QuarterlyRankingEntry {
  participantId: string;
  name: string;
  address: string | null;
  email: string | null;
  participationCount: number;
  publishedQuizCount: number;
  participationRate: number;
  eligible: boolean;
  rank: number | null;
  isWinner: boolean;
  officialPedagogicalScore: number;
  bestPedagogicalScore: number;
  pedagogicalMaxScore: number;
  examScore: number | null;
  combinedScore: number | null;
  firstValidExamAt: string | null;
}

function scoreOnTwenty(score: number, maxScore: number): number {
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) return 0;
  return Math.round((score / maxScore) * 20 * 100) / 100;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function startOfCotonouDay(date: string): Date {
  return new Date(`${date}T00:00:00+01:00`);
}

function endExclusiveOfCotonouDay(date: string): Date {
  const end = startOfCotonouDay(date);
  end.setDate(end.getDate() + 1);
  return end;
}

interface SubmissionRow {
  participant_id: string | null;
  quiz_id: string | null;
  score: number;
  max_score: number;
  cancelled: boolean;
  submitted_at: string;
  participant: {
    id: string;
    name: string;
    address: string | null;
    email: string | null;
  } | {
    id: string;
    name: string;
    address: string | null;
    email: string | null;
  }[] | null;
}

interface ParticipantAccumulator {
  participantId: string;
  name: string;
  address: string | null;
  email: string | null;
  official: Map<string, number>;
  best: Map<string, number>;
  examScore: number | null;
  firstValidExamAt: string | null;
}

/**
 * Calcule le classement officiel sans jamais utiliser une reprise comme score
 * de concours : la première tentative non annulée est officielle, tandis que
 * la meilleure note est conservée à part pour l'accompagnement pédagogique.
 */
export async function computeQuarterlyRanking(
  competition: QuarterlyCompetitionConfig
): Promise<{
  competition: QuarterlyCompetitionConfig;
  finalQuiz: { id: string; title: string; category: string };
  publishedQuizCount: number;
  eligibleCount: number;
  ranking: QuarterlyRankingEntry[];
}> {
  const supabase = getSupabaseAdmin();
  const start = startOfCotonouDay(competition.period_start);
  const endExclusive = endExclusiveOfCotonouDay(competition.period_end);

  const [{ data: finalQuiz, error: finalQuizError }, { data: quizzes, error: quizzesError }] =
    await Promise.all([
      supabase
        .from("daily_quizzes")
        .select("id, title, category")
        .eq("id", competition.final_quiz_id)
        .maybeSingle(),
      supabase
        .from("daily_quizzes")
        .select("id, title, category, created_at")
        .in("category", ["daily", "weekly"])
        .gte("created_at", start.toISOString())
        .lt("created_at", endExclusive.toISOString())
        .order("created_at", { ascending: true }),
    ]);

  if (finalQuizError) throw new Error(finalQuizError.message);
  if (quizzesError) throw new Error(quizzesError.message);
  if (!finalQuiz) throw new Error("Le quiz trimestriel final est introuvable.");
  if (finalQuiz.category !== "quarterly") {
    throw new Error("Le quiz sélectionné comme examen final n’est pas de catégorie trimestrielle.");
  }

  const publishedQuizIds = (quizzes ?? []).map((quiz) => quiz.id as string);
  const allQuizIds = [...publishedQuizIds, finalQuiz.id as string];
  const { data: submissions, error: submissionsError } = await supabase
    .from("daily_submissions")
    .select(
      "participant_id, quiz_id, score, max_score, cancelled, submitted_at, participant:participants(id, name, address, email)"
    )
    .in("quiz_id", allQuizIds)
    .order("submitted_at", { ascending: true });

  if (submissionsError) throw new Error(submissionsError.message);

  const accumulators = new Map<string, ParticipantAccumulator>();
  for (const row of (submissions ?? []) as SubmissionRow[]) {
    const participantRelation = Array.isArray(row.participant) ? row.participant[0] : row.participant;
    if (!row.participant_id || !row.quiz_id || !participantRelation || row.cancelled) continue;
    const participant = accumulators.get(row.participant_id) ?? {
      participantId: row.participant_id,
      name: participantRelation.name,
      address: participantRelation.address,
      email: participantRelation.email,
      official: new Map<string, number>(),
      best: new Map<string, number>(),
      examScore: null,
      firstValidExamAt: null,
    };
    const normalizedScore = scoreOnTwenty(row.score, row.max_score);

    if (row.quiz_id === finalQuiz.id) {
      if (participant.examScore === null) {
        participant.examScore = normalizedScore;
        participant.firstValidExamAt = row.submitted_at;
      }
    } else if (publishedQuizIds.includes(row.quiz_id)) {
      if (!participant.official.has(row.quiz_id)) {
        participant.official.set(row.quiz_id, normalizedScore);
      }
      const previousBest = participant.best.get(row.quiz_id) ?? 0;
      if (normalizedScore > previousBest) participant.best.set(row.quiz_id, normalizedScore);
    }
    accumulators.set(row.participant_id, participant);
  }

  const pedagogicalMaxScore = publishedQuizIds.length * 20;
  const allEntries = Array.from(accumulators.values()).map((participant) => {
    const participationCount = participant.official.size;
    const participationRate = publishedQuizIds.length
      ? round((participationCount / publishedQuizIds.length) * 100)
      : 0;
    const officialPedagogicalScore = round(
      Array.from(participant.official.values()).reduce((sum, score) => sum + score, 0)
    );
    const bestPedagogicalScore = round(
      Array.from(participant.best.values()).reduce((sum, score) => sum + score, 0)
    );
    const eligible = participationRate >= 80 && participant.examScore !== null;
    return {
      participantId: participant.participantId,
      name: participant.name,
      address: participant.address,
      email: participant.email,
      participationCount,
      publishedQuizCount: publishedQuizIds.length,
      participationRate,
      eligible,
      rank: null,
      isWinner: false,
      officialPedagogicalScore,
      bestPedagogicalScore,
      pedagogicalMaxScore,
      examScore: participant.examScore,
      combinedScore:
        participant.examScore === null ? null : round(officialPedagogicalScore + participant.examScore),
      firstValidExamAt: participant.firstValidExamAt,
    } as QuarterlyRankingEntry;
  });

  const eligibleEntries = allEntries
    .filter((entry) => entry.eligible)
    .sort(
      (a, b) =>
        (b.combinedScore ?? 0) - (a.combinedScore ?? 0) ||
        (b.examScore ?? 0) - (a.examScore ?? 0) ||
        b.participationRate - a.participationRate ||
        String(a.firstValidExamAt).localeCompare(String(b.firstValidExamAt))
    );

  eligibleEntries.forEach((entry, index) => {
    entry.rank = index + 1;
    entry.isWinner = index < competition.winner_count;
  });

  const ineligibleEntries = allEntries
    .filter((entry) => !entry.eligible)
    .sort(
      (a, b) =>
        b.participationRate - a.participationRate ||
        b.officialPedagogicalScore - a.officialPedagogicalScore ||
        String(a.name).localeCompare(String(b.name))
    );

  return {
    competition,
    finalQuiz: {
      id: finalQuiz.id,
      title: finalQuiz.title,
      category: finalQuiz.category,
    },
    publishedQuizCount: publishedQuizIds.length,
    eligibleCount: eligibleEntries.length,
    ranking: [...eligibleEntries, ...ineligibleEntries],
  };
}
