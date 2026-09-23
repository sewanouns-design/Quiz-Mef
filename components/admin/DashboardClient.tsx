"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import QuizTab from "./QuizTab";
import ParticipantsTab from "./ParticipantsTab";
import ResultsTab from "./ResultsTab";
import LeaderboardTab from "./LeaderboardTab";
import ParishLeaderboardTab from "./ParishLeaderboardTab";

const TABS = [
  { id: "quiz", label: "Quiz du jour" },
  { id: "participants", label: "Participants" },
  { id: "results", label: "Résultats" },
  { id: "leaderboard", label: "Classement général" },
  { id: "parish", label: "Classement par paroisse" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function DashboardClient() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("quiz");

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
            <span className="font-bold">Quiz Biblique MEF — Admin</span>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-white/30 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
          >
            Déconnexion
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <nav className="mb-6 flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === tab.id
                  ? "bg-navy text-white"
                  : "bg-white text-navy hover:bg-navy/10"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div>
          {activeTab === "quiz" && <QuizTab />}
          {activeTab === "participants" && <ParticipantsTab />}
          {activeTab === "results" && <ResultsTab />}
          {activeTab === "leaderboard" && <LeaderboardTab />}
          {activeTab === "parish" && <ParishLeaderboardTab />}
        </div>
      </div>
    </main>
  );
}
