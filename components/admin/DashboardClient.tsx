"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import OverviewTab from "./OverviewTab";
import QuizTab from "./QuizTab";
import ParticipantsTab from "./ParticipantsTab";
import ResultsTab from "./ResultsTab";
import LeaderboardTab from "./LeaderboardTab";
import SettingsTab from "./SettingsTab";
import LessonQuestionsTab from "./LessonQuestionsTab";
import SuggestionsTab from "./SuggestionsTab";
import BackupTab from "./BackupTab";
import VersesTab from "./VersesTab";
import VerseGamePlayersTab from "./VerseGamePlayersTab";
import VerseGameSettingsTab from "./VerseGameSettingsTab";
import UpdatesTab from "./UpdatesTab";

// Navigation à deux niveaux : catégories, puis sous-onglets (éventuellement
// regroupés sous un sous-titre, ex. "Trouve le verset" dans Jeux — pensé
// pour accueillir d'autres jeux plus tard sans tout réorganiser). Une
// catégorie "single" n'a qu'un seul contenu et saute directement dessus,
// sans barre de sous-onglets.
interface SubTab {
  id: string;
  label: string;
  render: () => React.ReactNode;
}

interface SubGroup {
  label: string | null;
  tabs: SubTab[];
}

interface Category {
  id: string;
  icon: string;
  label: string;
  single?: SubTab;
  groups?: SubGroup[];
}

const CATEGORIES: Category[] = [
  {
    id: "dashboard",
    icon: "📊",
    label: "Tableau de bord",
    single: { id: "overview", label: "Vue d'ensemble", render: () => <OverviewTab /> },
  },
  {
    id: "participants",
    icon: "👥",
    label: "Participants",
    single: { id: "participants", label: "Participants", render: () => <ParticipantsTab /> },
  },
  {
    id: "quiz",
    icon: "📝",
    label: "Quiz",
    groups: [
      {
        label: null,
        tabs: [
          { id: "quiz", label: "Quiz du jour", render: () => <QuizTab /> },
          { id: "questions", label: "Questions", render: () => <LessonQuestionsTab /> },
          { id: "suggestions", label: "Suggestions", render: () => <SuggestionsTab /> },
          { id: "results", label: "Résultats", render: () => <ResultsTab /> },
          { id: "leaderboard", label: "Classement", render: () => <LeaderboardTab /> },
        ],
      },
    ],
  },
  {
    id: "jeux",
    icon: "🎮",
    label: "Jeux",
    groups: [
      {
        label: "📖 Trouve le verset",
        tabs: [
          { id: "verses", label: "Versets", render: () => <VersesTab /> },
          { id: "verse-game-players", label: "Joueurs", render: () => <VerseGamePlayersTab /> },
          { id: "verse-game-settings", label: "Réglages", render: () => <VerseGameSettingsTab /> },
        ],
      },
    ],
  },
  {
    id: "edition",
    icon: "✏️",
    label: "Édition",
    groups: [
      {
        label: null,
        tabs: [
          { id: "settings", label: "Apparence", render: () => <SettingsTab /> },
          { id: "updates", label: "Nouveautés", render: () => <UpdatesTab /> },
        ],
      },
    ],
  },
  {
    id: "systeme",
    icon: "⚙️",
    label: "Système",
    single: { id: "backup", label: "Sauvegarde", render: () => <BackupTab /> },
  },
];

function flatTabs(cat: Category): SubTab[] {
  if (cat.single) return [cat.single];
  return cat.groups?.flatMap((g) => g.tabs) ?? [];
}

export default function DashboardClient() {
  const router = useRouter();
  const [activeCatId, setActiveCatId] = useState(CATEGORIES[0].id);
  const [activeSubId, setActiveSubId] = useState(flatTabs(CATEGORIES[0])[0].id);

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST", cache: "no-store" });
    router.push("/admin");
    router.refresh();
  }

  function selectCategory(cat: Category) {
    setActiveCatId(cat.id);
    setActiveSubId(flatTabs(cat)[0].id);
  }

  const activeCat = CATEGORIES.find((c) => c.id === activeCatId) ?? CATEGORIES[0];
  const activeTab =
    flatTabs(activeCat).find((t) => t.id === activeSubId) ?? flatTabs(activeCat)[0];

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <header className="border-b border-gray-200 bg-navy">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-white transition-opacity hover:opacity-80">
            <span className="text-2xl">⁉️</span>
            <span className="font-bold">Quiz Biblique — Admin</span>
          </Link>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-white/30 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
          >
            Déconnexion
          </button>
        </div>
      </header>

      {/* Niveau 1 : catégories */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm">
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => selectCategory(cat)}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold transition-colors sm:px-4 ${
                activeCatId === cat.id
                  ? "border-accent text-navy"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-navy"
              }`}
            >
              <span aria-hidden="true">{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Niveau 2 : sous-onglets de la catégorie active, groupés si besoin */}
      {activeCat.groups && (
        <div className="border-b border-gray-200 bg-navy/[0.03]">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-2.5 sm:px-6">
            {activeCat.groups.map((group, gi) => (
              <div key={gi} className="flex flex-wrap items-center gap-2">
                {group.label && (
                  <span className="pl-0.5 pr-1 text-xs font-extrabold uppercase tracking-wide text-gray-400">
                    {group.label}
                  </span>
                )}
                {group.tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSubId(tab.id)}
                    className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                      activeSubId === tab.id
                        ? "border-accent bg-accent text-white"
                        : "border-gray-200 bg-white text-gray-600 hover:border-accent-light"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
                {gi < activeCat.groups!.length - 1 && (
                  <span className="mx-1 h-5 w-px bg-gray-200" aria-hidden="true" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div>{activeTab.render()}</div>
      </div>
    </main>
  );
}
