import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";

const GAMES = [
  {
    href: "/trouve-le-verset",
    icon: "📖",
    title: "Trouve le verset",
    description: "Devine la référence ou complète le texte manquant — classement en direct.",
  },
];

export default function JeuxPage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen px-6 py-12">
        <div className="mx-auto max-w-md">
          <div className="mb-6 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-navy text-3xl shadow-lg">
              🎮
            </div>
            <h1 className="text-2xl font-bold text-navy">Jeux</h1>
            <p className="mt-1 text-gray-600">Des petits jeux bibliques à essayer quand tu veux.</p>
          </div>

          <div className="space-y-3">
            {GAMES.map((game) => (
              <Link
                key={game.href}
                href={game.href}
                className="flex items-center gap-3 rounded-2xl border-2 border-navy/15 bg-white px-4 py-4 text-left shadow-sm transition-transform hover:scale-[1.02] hover:border-accent/40"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-navy/5 text-2xl">
                  {game.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-navy">{game.title}</span>
                  <span className="block text-xs text-gray-500">{game.description}</span>
                </span>
                <span className="shrink-0 text-xl text-accent-dark">→</span>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
