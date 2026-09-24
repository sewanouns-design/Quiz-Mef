import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Quiz Biblique MEF",
    short_name: "Quiz Biblique",
    description: "Teste tes connaissances sur la leçon du jour — Mission Évangélique de la Foi",
    start_url: "/",
    display: "standalone",
    background_color: "#1a2e5a",
    theme_color: "#1a2e5a",
    icons: [
      { src: "/pwa-icon-192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon-192", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/pwa-icon-512", sizes: "512x512", type: "image/png" },
      { src: "/pwa-icon-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
