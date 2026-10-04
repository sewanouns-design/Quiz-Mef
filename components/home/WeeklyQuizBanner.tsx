import Link from "next/link";

interface Props {
  weeklyQuiz: { id: string; title: string } | null;
}

/**
 * Bannière très visible pour le quiz hebdomadaire (récap de la semaine) :
 * volontairement distincte du card "quiz du jour" (dégradé, icône animée)
 * pour qu'elle saute aux yeux sans dépendre des couleurs du site. Lien
 * direct vers ce quiz précis via ?quiz=<id>, sans passer par un sélecteur.
 */
export default function WeeklyQuizBanner({ weeklyQuiz }: Props) {
  if (!weeklyQuiz) return null;

  return (
    <Link
      href={`/quiz?quiz=${weeklyQuiz.id}`}
      className="mx-auto mb-6 flex w-full max-w-md items-center gap-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 shadow-lg transition-transform hover:scale-[1.02]"
    >
      <span className="flex h-11 w-11 shrink-0 animate-pulse items-center justify-center rounded-xl bg-white/20 text-2xl">
        📅
      </span>
      <div className="min-w-0 flex-1 text-left">
        <p className="text-xs font-bold uppercase tracking-wide text-white/90">
          Quiz hebdomadaire disponible
        </p>
        <p className="truncate text-sm font-semibold text-white">{weeklyQuiz.title}</p>
      </div>
      <span className="shrink-0 text-xl text-white">→</span>
    </Link>
  );
}
