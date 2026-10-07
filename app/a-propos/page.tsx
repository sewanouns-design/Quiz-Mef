import { getSiteSettings } from "@/lib/site-settings";
import SiteHeader from "@/components/SiteHeader";

export const dynamic = "force-dynamic";

export default async function AProposPage() {
  const settings = await getSiteSettings();

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen px-6 py-12">
        <div className="mx-auto max-w-md">
          <div className="mb-6 text-center">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-navy text-3xl shadow-lg">
              ℹ️
            </div>
            <h1 className="text-2xl font-bold text-navy">À propos</h1>
          </div>

          <div className="card">
            <p className="whitespace-pre-line text-gray-700">{settings.about_text}</p>
          </div>
        </div>
      </main>
    </>
  );
}
