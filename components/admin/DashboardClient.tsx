"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import OverviewTab from "./OverviewTab";
import QuizTab from "./QuizTab";
import ParticipantsTab from "./ParticipantsTab";
import ResultsTab from "./ResultsTab";
import LeaderboardTab from "./LeaderboardTab";
import SettingsTab from "./SettingsTab";

const TABS = [
  { id: "overview", label: "Vue d'ensemble", icon: "📊" },
  { id: "quiz", label: "Quiz du jour", icon: "📝" },
  { id: "participants", label: "Participants", icon: "👥" },
  { id: "results", label: "Résultats", icon: "🏆" },
  { id: "leaderboard", label: "Classement", icon: "🥇" },
  { id: "settings", label: "Personnalisation", icon: "🎨" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function DashboardClient() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST", cache: "no-store" });
    router.push("/admin");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <header className="border-b border-gray-200 bg-navy">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2 text-white">
            <span className="text-2xl">⁉️</span>
            <span className="font-bold">Quiz Biblique — Admin</span>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-white/30 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
          >
            Déconnexion
          </button>
        </div>
      </header>

      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white shadow-sm">
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-semibold transition-colors sm:px-4 ${
                activeTab === tab.id
                  ? "border-accent text-navy"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-navy"
              }`}
            >
              <span aria-hidden="true">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div>
          {activeTab === "overview" && <OverviewTab />}
          {activeTab === "quiz" && <QuizTab />}
          {activeTab === "participants" && <ParticipantsTab />}
          {activeTab === "results" && <ResultsTab />}
          {activeTab === "leaderboard" && <LeaderboardTab />}
          {activeTab === "settings" && <SettingsTab />}
        </div>
      </div>
    </main>
  );
}
