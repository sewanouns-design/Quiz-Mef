export interface AdminNavigationItem {
  id: string;
  label: string;
  group: string | null;
}

export interface AdminNavigationCategory {
  id: string;
  icon: string;
  label: string;
  items: AdminNavigationItem[];
}

export interface AdminNavigationConfig {
  categories: AdminNavigationCategory[];
}

export const ADMIN_NAVIGATION_TAB_IDS = [
  "overview",
  "analytics",
  "participants",
  "quiz",
  "daily-lesson",
  "lesson-source",
  "questions",
  "suggestions",
  "results",
  "leaderboard",
  "quarterly-ranking",
  "verses",
  "verse-game-players",
  "verse-game-settings",
  "settings",
  "push-notifications",
  "updates",
  "navigation",
  "backup",
] as const;

export const DEFAULT_ADMIN_NAVIGATION: AdminNavigationConfig = {
  categories: [
    { id: "dashboard", icon: "📊", label: "Tableau de bord", items: [{ id: "overview", label: "Vue d'ensemble", group: null }] },
    { id: "analytics", icon: "📈", label: "Analytics", items: [{ id: "analytics", label: "Analytics", group: null }] },
    { id: "participants", icon: "👥", label: "Participants", items: [{ id: "participants", label: "Participants", group: null }] },
    {
      id: "quiz",
      icon: "📝",
      label: "Quiz",
      items: [
        { id: "quiz", label: "Quiz du jour", group: null },
        { id: "daily-lesson", label: "Leçon du jour", group: null },
        { id: "lesson-source", label: "Source du trimestre", group: null },
        { id: "questions", label: "Questions", group: null },
        { id: "suggestions", label: "Suggestions", group: null },
        { id: "results", label: "Résultats", group: null },
        { id: "leaderboard", label: "Classement", group: null },
        { id: "quarterly-ranking", label: "Gagnants trimestriels", group: null },
      ],
    },
    {
      id: "jeux",
      icon: "🎮",
      label: "Jeux",
      items: [
        { id: "verses", label: "Versets", group: "📖 Trouve le verset" },
        { id: "verse-game-players", label: "Joueurs", group: "📖 Trouve le verset" },
        { id: "verse-game-settings", label: "Réglages", group: "📖 Trouve le verset" },
      ],
    },
    {
      id: "edition",
      icon: "✏️",
      label: "Édition",
      items: [
        { id: "settings", label: "Apparence", group: null },
        { id: "push-notifications", label: "Notifications push", group: null },
        { id: "updates", label: "Nouveautés", group: null },
        { id: "navigation", label: "Onglets admin", group: null },
      ],
    },
    { id: "systeme", icon: "⚙️", label: "Système", items: [{ id: "backup", label: "Sauvegarde", group: null }] },
  ],
};

function cleanText(value: unknown, fallback: string, max: number): string {
  if (typeof value !== "string") return fallback;
  const text = value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
  return text || fallback;
}

export function normalizeAdminNavigation(value: unknown): AdminNavigationConfig {
  if (!value || typeof value !== "object" || !Array.isArray((value as { categories?: unknown }).categories)) {
    return DEFAULT_ADMIN_NAVIGATION;
  }

  const source = value as { categories: unknown[] };
  const seen = new Set<string>();
  const categories: AdminNavigationCategory[] = [];

  for (const rawCategory of source.categories) {
    if (!rawCategory || typeof rawCategory !== "object") continue;
    const category = rawCategory as { id?: unknown; icon?: unknown; label?: unknown; items?: unknown };
    const id = cleanText(category.id, "", 60);
    if (!id || seen.has(id) || !Array.isArray(category.items)) continue;

    const items: AdminNavigationItem[] = [];
    for (const rawItem of category.items) {
      if (!rawItem || typeof rawItem !== "object") continue;
      const item = rawItem as { id?: unknown; label?: unknown; group?: unknown };
      const itemId = cleanText(item.id, "", 60);
      if (!itemId || seen.has(itemId)) continue;
      seen.add(itemId);
      items.push({
        id: itemId,
        label: cleanText(item.label, itemId, 100),
        group: typeof item.group === "string" && item.group.trim() ? cleanText(item.group, "", 100) : null,
      });
    }
    if (items.length > 0) {
      categories.push({
        id,
        icon: cleanText(category.icon, "📁", 8),
        label: cleanText(category.label, id, 80),
        items,
      });
    }
  }

  const defaultItems = DEFAULT_ADMIN_NAVIGATION.categories.flatMap((category) => category.items);
  const missing = defaultItems.filter((item) => !seen.has(item.id));
  if (missing.length > 0) {
    const fallback = categories.find((category) => category.id === "edition") ?? categories[0];
    if (fallback) fallback.items.push(...missing);
  }

  return categories.length > 0 ? { categories } : DEFAULT_ADMIN_NAVIGATION;
}
