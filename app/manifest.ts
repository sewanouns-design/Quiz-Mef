import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Quiz Biblique MEF",
    short_name: "Quiz Biblique",
    description: "Teste tes connaissances sur la leçon du jour — Mission Évangélique de la Foi",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1a2e5a",
    icons: [
      { src: "/icons/pwa-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/pwa-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/pwa-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/pwa-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
