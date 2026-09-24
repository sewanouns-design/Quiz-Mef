import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "Quiz Biblique",
  description: "Teste tes connaissances sur la leçon du jour — Mission Évangélique de la Foi",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Quiz Biblique",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a2e5a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
