import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KAI Trading Dashboard",
    short_name: "KAI Trading",
    description: "Market dashboard for symbols, watchlists, and trading system health.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#07182d",
    theme_color: "#13283f",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/app-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
