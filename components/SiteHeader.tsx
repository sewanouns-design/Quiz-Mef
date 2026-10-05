import Link from "next/link";

/**
 * Repère discret en haut de chaque page (hors quiz en cours, pour ne pas
 * donner un moyen silencieux de quitter une tentative sans qu'elle soit
 * comptée) : un clic ramène toujours à l'accueil, quel que soit l'endroit
 * du site où on se trouve.
 */
export default function SiteHeader() {
  return (
    <div className="sticky top-0 z-30 border-b border-gray-100 bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-2xl px-4 py-2.5 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-navy transition-opacity hover:opacity-70"
        >
          <span className="text-lg" aria-hidden="true">
            ⁉️
          </span>
          Quiz Biblique
        </Link>
      </div>
    </div>
  );
}
