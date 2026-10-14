"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import OverviewTab from "./OverviewTab";
import AnalyticsTab from "./AnalyticsTab";
import QuizTab from "./QuizTab";
import ParticipantsTab from "./ParticipantsTab";
import ResultsTab from "./ResultsTab";
import LeaderboardTab from "./LeaderboardTab";
import QuarterlyRankingTab from "./QuarterlyRankingTab";
import SettingsTab from "./SettingsTab";
import PushNotificationsTab from "./PushNotificationsTab";
import LessonQuestionsTab from "./LessonQuestionsTab";
import SuggestionsTab from "./SuggestionsTab";
import BackupTab from "./BackupTab";
import VersesTab from "./VersesTab";
import VerseGamePlayersTab from "./VerseGamePlayersTab";
import VerseGameSettingsTab from "./VerseGameSettingsTab";
import UpdatesTab from "./UpdatesTab";
import LessonSourceTab from "./LessonSourceTab";
import DailyLessonTab from "./DailyLessonTab";
import NavigationTab from "./NavigationTab";
import {
  DEFAULT_ADMIN_NAVIGATION,
  normalizeAdminNavigation,
  type AdminNavigationConfig,
  type AdminNavigationItem,
} from "@/lib/admin-navigation";

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

const TAB_RENDERERS: Record<string, (onNavigationSaved: () => void) => React.ReactNode> = {
  overview: () => <OverviewTab />,
  analytics: () => <AnalyticsTab />,
  participants: () => <ParticipantsTab />,
  quiz: () => <QuizTab />,
  "daily-lesson": () => <DailyLessonTab />,
  "lesson-source": () => <LessonSourceTab />,
  questions: () => <LessonQuestionsTab />,
  suggestions: () => <SuggestionsTab />,
  results: () => <ResultsTab />,
  leaderboard: () => <LeaderboardTab />,
  "quarterly-ranking": () => <QuarterlyRankingTab />,
  verses: () => <VersesTab />,
  "verse-game-players": () => <VerseGamePlayersTab />,
  "verse-game-settings": () => <VerseGameSettingsTab />,
  settings: () => <SettingsTab />,
  "push-notifications": () => <PushNotificationsTab />,
  updates: () => <UpdatesTab />,
  navigation: (onNavigationSaved) => <NavigationTab onSaved={onNavigationSaved} />,
  backup: () => <BackupTab />,
};

function buildCategories(config: AdminNavigationConfig, onNavigationSaved: () => void): Category[] {
  return config.categories.map((category) => {
    const tabs: (SubTab & { group: string | null })[] = [];
    for (const item of category.items as AdminNavigationItem[]) {
      const renderer = TAB_RENDERERS[item.id];
      if (!renderer) continue;
      tabs.push({ id: item.id, label: item.label, group: item.group, render: () => renderer(onNavigationSaved) });
    }

    if (tabs.length === 1) {
      return { id: category.id, icon: category.icon, label: category.label, single: tabs[0] };
    }

    const groups: SubGroup[] = [];
    for (const tab of tabs) {
      const group = groups.find((candidate) => candidate.label === tab.group);
      if (group) group.tabs.push(tab);
      else groups.push({ label: tab.group, tabs: [tab] });
    }
    return { id: category.id, icon: category.icon, label: category.label, groups };
  });
}

function flatTabs(cat: Category): SubTab[] {
  if (cat.single) return [cat.single];
  return cat.groups?.flatMap((group) => group.tabs) ?? [];
}

export default function DashboardClient() {
  const router = useRouter();
  const [navigation, setNavigation] = useState<AdminNavigationConfig>(DEFAULT_ADMIN_NAVIGATION);
  const [navigationError, setNavigationError] = useState("");
  const [activeCatId, setActiveCatId] = useState(DEFAULT_ADMIN_NAVIGATION.categories[0].id);
  const [activeSubId, setActiveSubId] = useState(DEFAULT_ADMIN_NAVIGATION.categories[0].items[0].id);

  async function loadNavigation() {
    try {
      const response = await fetch("/api/admin/navigation", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Navigation indisponible");
      setNavigation(normalizeAdminNavigation(data.navigation));
      setNavigationError("");
    } catch (error) {
      setNavigationError(error instanceof Error ? error.message : "Navigation indisponible");
    }
  }

  useEffect(() => {
    void loadNavigation();
  }, []);

  const categories = useMemo(() => buildCategories(navigation, loadNavigation), [navigation]);

  useEffect(() => {
    const category = categories.find((candidate) => candidate.id === activeCatId) ?? categories[0];
    const tabs = flatTabs(category);
    if (!category || !tabs.length) return;
    if (category.id !== activeCatId) setActiveCatId(category.id);
    if (!tabs.some((tab) => tab.id === activeSubId)) setActiveSubId(tabs[0].id);
  }, [categories, activeCatId, activeSubId]);

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST", cache: "no-store" });
    router.push("/admin");
    router.refresh();
  }

  function selectCategory(category: Category) {
    setActiveCatId(category.id);
    setActiveSubId(flatTabs(category)[0].id);
  }

  const activeCat = categories.find((category) => category.id === activeCatId) ?? categories[0];
  const activeTab = activeCat ? flatTabs(activeCat).find((tab) => tab.id === activeSubId) ?? flatTabs(activeCat)[0] : null;

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <header className="border-b border-gray-200 bg-navy">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-white transition-opacity hover:opacity-80">
            <span className="text-2xl">⁉️</span>
            <span className="font-bold">Quiz Biblique — Admin</span>
          </Link>
          <button onClick={handleLogout} className="rounded-lg border border-white/30 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10">
            Déconnexion
          </button>
        </div>
      </header>

      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm">
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {categories.map((category) => (
            <button key={category.id} onClick={() => selectCategory(category)} className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold transition-colors sm:px-4 ${activeCatId === category.id ? "border-accent text-navy" : "border-transparent text-gray-500 hover:border-gray-300 hover:text-navy"}`}>
              <span aria-hidden="true">{category.icon}</span>
              {category.label}
            </button>
          ))}
        </nav>
      </div>

      {activeCat?.groups && (
        <div className="border-b border-gray-200 bg-navy/[0.03]">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-2.5 sm:px-6">
            {activeCat.groups.map((group, groupIndex) => (
              <div key={`${group.label ?? "none"}-${groupIndex}`} className="flex flex-wrap items-center gap-2">
                {group.label && <span className="pl-0.5 pr-1 text-xs font-extrabold uppercase tracking-wide text-gray-400">{group.label}</span>}
                {group.tabs.map((tab) => (
                  <button key={tab.id} onClick={() => setActiveSubId(tab.id)} className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${activeSubId === tab.id ? "border-accent bg-accent text-white" : "border-gray-200 bg-white text-gray-600 hover:border-accent-light"}`}>
                    {tab.label}
                  </button>
                ))}
                {groupIndex < activeCat.groups!.length - 1 && <span className="mx-1 h-5 w-px bg-gray-200" aria-hidden="true" />}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {navigationError && <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">Structure par défaut utilisée : {navigationError}</p>}
        <div>{activeTab?.render()}</div>
      </div>
    </main>
  );
}
