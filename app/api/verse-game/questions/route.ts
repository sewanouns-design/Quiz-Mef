import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { MAX_LEVEL } from "@/lib/verse-level";
import type { BibleVerse } from "@/lib/types";

export const dynamic = "force-dynamic";

const DEFAULT_COUNT = 8;
const MAX_COUNT = 20;

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
 * Banque de questions pour "Trouve le verset" : jeu à 100 niveaux, chacun
 * piochant exclusivement dans les versets de ce niveau (voir
 * get_random_bible_verses_by_level, migration verse_game_levels) — niveau 1
 * les versets les plus courts/faciles, niveau 100 les plus longs/difficiles.
 * Mélangé aléatoirement à chaque partie, différemment pour chaque joueur.
 *
 * Les bonnes réponses sont incluses dans la réponse (contrairement au quiz
 * du jour) car il n'y a ici aucun enjeu de classement anti-triche à
 * protéger — juste un retour immédiat au clic.
 */
export async function GET(request: NextRequest) {
  const countParam = Number(request.nextUrl.searchParams.get("count"));
  const count =
    Number.isFinite(countParam) && countParam > 0 ? Math.min(countParam, MAX_COUNT) : DEFAULT_COUNT;

  const levelParam = Number(request.nextUrl.searchParams.get("level"));
  const level =
    Number.isFinite(levelParam) && levelParam >= 1 && levelParam <= MAX_LEVEL ? Math.floor(levelParam) : 1;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("get_random_bible_verses_by_level", {
    lvl: level,
    limit_count: Math.max(count * 4, 40),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const pool = (data ?? []) as BibleVerse[];
  if (pool.length < 4) {
    return NextResponse.json(
      { error: "Pas encore assez de versets enregistrés à ce niveau pour jouer." },
      { status: 400 }
    );
  }

  const withBlank = pool.filter((v) => v.blank_word && v.text.includes(v.blank_word));
  const selected = shuffle(pool).slice(0, Math.min(count, pool.length));

  const questions: (ReferenceQuestion | CompleteQuestion)[] = selected.map((verse) => {
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

    const decoyRefs = shuffle(pool.filter((v) => v.id !== verse.id).map((v) => v.reference)).slice(0, 3);
    return {
      type: "reference",
      verseId: verse.id,
      prompt: verse.text,
      options: shuffle([verse.reference, ...decoyRefs]),
      correctAnswer: verse.reference,
    };
  });

  return NextResponse.json({ questions, level });
}
