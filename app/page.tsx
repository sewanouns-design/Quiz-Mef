import { getSupabaseAdmin } from "@/lib/supabase";
import { getSiteSettings } from "@/lib/site-settings";
import HomeStepsTemplate from "@/components/home/HomeStepsTemplate";
import HomeMinimalTemplate from "@/components/home/HomeMinimalTemplate";
import HomeCardTemplate from "@/components/home/HomeCardTemplate";

export const dynamic = "force-dynamic";

async function getActiveQuiz() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("daily_quizzes")
    .select("id, title, lesson_date")
    .eq("is_active", true)
    .order("lesson_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Erreur récupération quiz actif :", error.message);
    return null;
  }
  return data;
}

async function getStats() {
  const supabase = getSupabaseAdmin();

  const [participants, submissions, quizzes] = await Promise.all([
    supabase.from("participants").select("*", { count: "exact", head: true }),
    supabase.from("daily_submissions").select("*", { count: "exact", head: true }),
    supabase.from("daily_quizzes").select("*", { count: "exact", head: true }),
  ]);

  return {
    participants: participants.count ?? 0,
    submissions: submissions.count ?? 0,
    quizzes: quizzes.count ?? 0,
  };
}

export default async function HomePage() {
  const [settings, activeQuiz, stats] = await Promise.all([
    getSiteSettings(),
    getActiveQuiz(),
    getStats(),
  ]);

  const props = { settings, activeQuiz, stats };

  if (settings.template === "minimal") {
    return <HomeMinimalTemplate {...props} />;
  }
  if (settings.template === "card") {
    return <HomeCardTemplate {...props} />;
  }
  return <HomeStepsTemplate {...props} />;
}
