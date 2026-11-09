import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Obsidian Research",
    short_name: "Obsidian",
    description: "Explore Obsidian Research services, apply for training, and manage your workspace.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#070b15",
    theme_color: "#070b15",
    icons: [
      { src: "/icons/obsidian-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/obsidian-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/obsidian-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "My Workspace", url: "/dashboard" },
      { name: "Solar inverter estimator", url: "/services/solar-power#solar-estimator" },
    ],
  };
}
