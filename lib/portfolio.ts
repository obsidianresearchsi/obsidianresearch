import type { Content } from "./model";

export type PortfolioProject = { id: string; title: string; summary: string; body: string; image: string; video: string; url: string; sample?: boolean };

export function portfolioUrl(raw: unknown, local = false) {
  if (typeof raw !== "string" || raw.length > 1000 || /[\\\r\n]/.test(raw)) return "";
  if (local && /^\/(?!\/)[a-z0-9/?_&=%+.#-]*$/i.test(raw)) return raw;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
  } catch { return ""; }
}

export function portfolioVideo(raw: unknown): { kind: "file" | "embed"; url: string } | null {
  const href = portfolioUrl(raw);
  if (!href) return null;
  const url = new URL(href);
  if (/\.(mp4|webm)$/i.test(url.pathname)) return { kind: "file", url: href };
  const video = url.hostname === "youtu.be" ? url.pathname.slice(1)
    : ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)
      ? url.searchParams.get("v") ?? url.pathname.match(/^\/(?:shorts|embed)\/([\w-]+)$/)?.[1] : "";
  if (video && /^[\w-]{11}$/.test(video)) return { kind: "embed", url: `https://www.youtube-nocookie.com/embed/${video}` };
  if (["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(url.hostname)) {
    const id = url.pathname.match(/^\/(?:video\/)?(\d{1,12})\/?$/)?.[1];
    if (id) return { kind: "embed", url: `https://player.vimeo.com/video/${id}?dnt=1` };
  }
  return null;
}

export function toPortfolioProject(row: Content): PortfolioProject {
  return { id: row.id, title: row.title, summary: row.summary, body: row.body,
    image: portfolioUrl(row.details.image_url, true), video: portfolioUrl(row.details.video_url), url: portfolioUrl(row.details.project_url, true) };
}

export const STUDIO_SHOWCASES: PortfolioProject[] = [
  { id: "showcase-interior", title: "Interior Studio", summary: "Explore materials, layouts and wall finishes in a configurable room.", body: "",
    image: "/media/interior-portfolio.svg", video: "", url: "/services/interior-design#interior-planner", sample: true },
  { id: "showcase-network", title: "Connected Spaces", summary: "Structured networking and Starlink for homes and workspaces.", body: "",
    image: "/media/networking.webp", video: "", url: "/services/advanced-networking", sample: true },
  { id: "showcase-energy", title: "Backup Power", summary: "Plan the appliances you want to keep on when mains power goes out.", body: "",
    image: "/media/infrastructure.webp", video: "", url: "/services/solar-power#solar-estimator", sample: true },
];
