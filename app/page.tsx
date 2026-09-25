import { unstable_cache } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSiteSettings } from "@/lib/site-settings";
import HomeStepsTemplate from "@/components/home/HomeStepsTemplate";
import HomeMinimalTemplate from "@/components/home/HomeMinimalTemplate";
import HomeCardTemplate from "@/components/home/HomeCardTemplate";

// La page reste rendue à chaque requête (pas de génération statique au
// build, qui échouerait de toute façon sans les identifiants Supabase à ce
// stade) : c'est la DONNÉE elle-même qui est mise en cache ci-dessous via
// unstable_cache, indépendamment du mode de rendu de la page. Beaucoup plus
// rapide pour les visiteurs (la plupart des requêtes ne touchent pas du
// tout Supabase), tout en restant à jour instantanément dès qu'un
// changement admin pertinent appelle revalidateTag("home") — voir les
// routes admin concernées (paramètres, quiz créé/modifié/activé...).
export const dynamic = "force-dynamic";

const getCachedSiteSettings = unstable_cache(getSiteSettings, ["home-site-settings"], {
  revalidate: 300,
  tags: ["home"],
});

const getCachedActiveQuiz = unstable_cache(
  async () => {
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
  },
  ["home-active-quiz"],
  { revalidate: 300, tags: ["home"] }
);

const getCachedStats = unstable_cache(
  async () => {
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
  },
  ["home-stats"],
  // Les compteurs n'ont pas besoin d'être instantanés : un filet de
  // sécurité de 5 minutes suffit, sans jamais appeler revalidateTag pour
  // ça (sinon chaque soumission de quiz invaliderait le cache de tout le
  // monde en permanence).
  { revalidate: 300, tags: ["home"] }
);

export default async function HomePage() {
  const [settings, activeQuiz, stats] = await Promise.all([
    getCachedSiteSettings(),
    getCachedActiveQuiz(),
    getCachedStats(),
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
