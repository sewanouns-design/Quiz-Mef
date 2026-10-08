import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getVerseDifficulty } from "@/lib/verse-difficulty";
import type { BibleVerse } from "@/lib/types";

export const dynamic = "force-dynamic";

const DEFAULT_COUNT = 8;
const MAX_COUNT = 20;
// Taille du lot aléatoire tiré de la banque entière (via la fonction SQL
// get_random_bible_verses, voir migration) pour constituer à la fois les
// questions et les leurres, et avoir assez de versets de chaque difficulté
// pour construire une progression facile → difficile : large par rapport à
// `count`, mais indépendant de la taille totale de la banque (10 versets ou
// 30 000, même coût).
const RANDOM_POOL_SIZE = 150;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface ReferenceQuestion {
  type: "reference";
  verseId: string;
  prompt: string;
  options: string[];
  correctAnswer: string;
}

interface CompleteQuestion {
  type: "complete";
  verseId: string;
  reference: string;
  before: string;
  after: string;
  options: string[];
  correctAnswer: string;
}

/**
 * Construit la liste finale de versets à utiliser pour les questions :
 * mélangée aléatoirement À L'INTÉRIEUR de chaque palier de difficulté (donc
 * différente d'une partie à l'autre, même pour le même joueur), mais les
 * paliers eux-mêmes s'enchaînent toujours facile → moyen → difficile, pour
 * une difficulté progressive au fil de la partie.
 */
function buildProgressivePool(pool: BibleVerse[], count: number): BibleVerse[] {
  const byTier: Record<"easy" | "medium" | "hard", BibleVerse[]> = {
    easy: [],
    medium: [],
    hard: [],
  };
  for (const verse of shuffle(pool)) {
    byTier[getVerseDifficulty(verse)].push(verse);
  }

  const perTier = Math.ceil(count / 3);
  const ordered: BibleVerse[] = [];
  const tiers: ("easy" | "medium" | "hard")[] = ["easy", "medium", "hard"];

  for (const tier of tiers) {
    ordered.push(...byTier[tier].splice(0, perTier));
  }

  // Si un palier n'avait pas assez de versets, complète avec ce qu'il reste
  // (quel que soit le palier), toujours en respectant l'ordre facile → dur.
  if (ordered.length < count) {
    const leftovers = [...byTier.easy, ...byTier.medium, ...byTier.hard];
    ordered.push(...leftovers.slice(0, count - ordered.length));
  }

  return ordered.slice(0, count);
}

/**
 * Banque de questions pour "Trouve le verset" : jeu permanent, rejouable à
 * tout moment, sans identification. Les bonnes réponses sont incluses dans
 * la réponse (contrairement au quiz du jour) car il n'y a ici aucun enjeu de
 * classement ou d'anti-triche à protéger — juste un retour immédiat au clic.
 *
 * Le tirage passe par la fonction SQL get_random_bible_verses plutôt que de
 * charger toute la table : avec une banque de plusieurs milliers de versets
 * (ex. la Bible complète), récupérer tout en mémoire à chaque partie serait
 * lent et ne piocherait de toute façon pas vraiment au hasard dans
 * l'ensemble (l'API Supabase plafonne une requête à 1000 lignes).
 */
export async function GET(request: NextRequest) {
  const countParam = Number(request.nextUrl.searchParams.get("count"));
  const count =
    Number.isFinite(countParam) && countParam > 0 ? Math.min(countParam, MAX_COUNT) : DEFAULT_COUNT;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("get_random_bible_verses", {
    limit_count: Math.max(RANDOM_POOL_SIZE, count * 8),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const randomPool = (data ?? []) as BibleVerse[];
  if (randomPool.length < 4) {
    return NextResponse.json(
      { error: "Pas encore assez de versets enregistrés pour jouer." },
      { status: 400 }
    );
  }

  const withBlank = randomPool.filter((v) => v.blank_word && v.text.includes(v.blank_word));
  const pool = buildProgressivePool(randomPool, Math.min(count, randomPool.length));

  const questions: (ReferenceQuestion | CompleteQuestion)[] = pool.map((verse) => {
    const canComplete =
      Boolean(verse.blank_word) && verse.text.includes(verse.blank_word as string) && withBlank.length >= 4;
    const useComplete = canComplete && Math.random() < 0.5;

    if (useComplete) {
      const blankWord = verse.blank_word as string;
      const idx = verse.text.indexOf(blankWord);
      const before = verse.text.slice(0, idx);
      const after = verse.text.slice(idx + blankWord.length);
      const decoyPool = withBlank.filter((v) => v.id !== verse.id).map((v) => v.blank_word as string);
      const decoys = shuffle(decoyPool).slice(0, 3);
      return {
        type: "complete",
        verseId: verse.id,
        reference: verse.reference,
        before,
        after,
        options: shuffle([blankWord, ...decoys]),
        correctAnswer: blankWord,
      };
    }

    const decoyRefs = shuffle(randomPool.filter((v) => v.id !== verse.id).map((v) => v.reference)).slice(
      0,
      3
    );
    return {
      type: "reference",
      verseId: verse.id,
      prompt: verse.text,
      options: shuffle([verse.reference, ...decoyRefs]),
      correctAnswer: verse.reference,
    };
  });

  return NextResponse.json({ questions });
}
