import type { Metadata, Viewport } from "next";
import "./globals.css";
import { inter } from "@/lib/fonts";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import InstallPrompt from "@/components/InstallPrompt";
import { ToastProvider } from "@/components/Toast";

const title = "Quiz Biblique";
const description = "Teste tes connaissances sur la leçon du jour — Mission Évangélique de la Foi";

export const metadata: Metadata = {
  metadataBase: new URL("https://quiz.mefzogbadje.org"),
  title,
  description,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Quiz Biblique",
  },
  // L'image d'aperçu (og:image / twitter:image) vient des fichiers
  // app/opengraph-image.tsx et app/twitter-image.tsx, générés à partir des
  // couleurs et du logo réels du site — Next.js les détecte et les associe
  // automatiquement ici.
  openGraph: {
    title,
    description,
    siteName: title,
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export const viewport: Viewport = {
  themeColor: "#1a2e5a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={inter.variable}>
      <body>
        <ToastProvider>
          {children}
          <ServiceWorkerRegister />
          <InstallPrompt />
        </ToastProvider>
      </body>
    </html>
  );
}
