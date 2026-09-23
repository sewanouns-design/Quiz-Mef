"use client";

import { useState } from "react";
import HomeStepsTemplate from "@/components/home/HomeStepsTemplate";
import HomeMinimalTemplate from "@/components/home/HomeMinimalTemplate";
import HomeCardTemplate from "@/components/home/HomeCardTemplate";
import type { SiteSettings } from "@/lib/types";

const PREVIEW_QUIZ = {
  id: "preview",
  title: "Leçon du dimanche — Exemple",
  lesson_date: new Date().toISOString(),
};

const PREVIEW_STATS = { participants: 128, submissions: 94, quizzes: 12 };

const DEVICES = {
  desktop: { width: 1280, frameWidth: 380 },
  mobile: { width: 390, frameWidth: 260 },
} as const;

type DeviceId = keyof typeof DEVICES;

export default function HomePreview({ settings }: { settings: SiteSettings }) {
  const [device, setDevice] = useState<DeviceId>("desktop");

  const Template =
    settings.template === "minimal"
      ? HomeMinimalTemplate
      : settings.template === "card"
        ? HomeCardTemplate
        : HomeStepsTemplate;

  const { width, frameWidth } = DEVICES[device];
  const scale = frameWidth / width;

  return (
    <div className="sticky top-6">
      <div className="mb-3 flex items-center justify-between">
        <p className="label-field mb-0">Aperçu en direct</p>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setDevice("desktop")}
            className={`rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
              device === "desktop" ? "bg-white shadow-sm" : "text-gray-500"
            }`}
            style={device === "desktop" ? { color: settings.color_primary } : undefined}
          >
            🖥️ Web
          </button>
          <button
            type="button"
            onClick={() => setDevice("mobile")}
            className={`rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
              device === "mobile" ? "bg-white shadow-sm" : "text-gray-500"
            }`}
            style={device === "mobile" ? { color: settings.color_primary } : undefined}
          >
            📱 Mobile
          </button>
        </div>
      </div>

      <div
        className="overflow-hidden rounded-2xl border-4 border-gray-800 bg-white shadow-lg"
        style={{ width: frameWidth, height: 560 }}
      >
        <div className="h-full w-full overflow-y-auto">
          <div style={{ width, transform: `scale(${scale})`, transformOrigin: "top left" }}>
            <Template settings={settings} activeQuiz={PREVIEW_QUIZ} stats={PREVIEW_STATS} />
          </div>
        </div>
      </div>

      <p className="mt-2 max-w-[380px] text-xs text-gray-400">
        Aperçu avec des données d&apos;exemple. Les vraies statistiques et le vrai quiz du jour
        s&apos;afficheront sur la page réelle.
      </p>
    </div>
  );
}
