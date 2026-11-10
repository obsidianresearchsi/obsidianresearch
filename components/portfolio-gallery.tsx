"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight, Box, Pause, Play, Square } from "lucide-react";
import { portfolioVideo, type PortfolioProject } from "@/lib/portfolio";
import type { GallerySlot } from "./portfolio-scene";

const GalleryScene = dynamic(() => import("./portfolio-scene"), {
  ssr: false, loading: () => <div className="portfolio-stage portfolio-stage-fallback">Opening the 3D gallery…</div>,
});

export function PortfolioGallery({ projects }: { projects: PortfolioProject[] }) {
  const [{ index, direction }, setSelection] = useState({ index: 0, direction: 1 });
  const [ready, setReady] = useState<boolean | null>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [motionPaused, setMotionPaused] = useState(false);
  const [videoFallback, setVideoFallback] = useState(false);
  const count = projects.length;
  const active = projects[index];
  const video = portfolioVideo(active.video);
  const slots = useMemo<GallerySlot[]>(() => {
    const items = [{ x: 0, project: projects[index] }];
    if (projects.length > 1) items.push({ x: 2.8, project: projects[(index + 1) % projects.length] });
    if (projects.length > 2) items.unshift({ x: -2.8, project: projects[(index - 1 + projects.length) % projects.length] });
    return items;
  }, [projects, index]);

  function select(next: number, step?: number) {
    if (next < 0 || next >= count) return;
    const forward = (next - index + count) % count;
    if (!forward) return;
    setSelection({ index: next, direction: step ?? (forward <= count / 2 ? 1 : -1) });
    setShowVideo(false);
    setVideoFallback(false);
  }
  const step = (amount: number) => select((index + amount + count) % count, amount);
  const file = showVideo && ready && !videoFallback && video?.kind === "file" ? video.url : "";
  return <section className="portfolio-gallery" aria-label="Project gallery">
    <div className="portfolio-shell">
      <header className="portfolio-room-top"><span><Box size={18} aria-hidden /> OBSIDIAN GALLERY</span>
        <div className="portfolio-room-status">
          {ready && <button className="portfolio-motion-control" type="button" onClick={() => setMotionPaused(!motionPaused)}
            aria-label={motionPaused ? "Resume camera motion" : "Pause camera motion"}>
            {motionPaused ? <Play size={16} aria-hidden /> : <Pause size={16} aria-hidden />}
          </button>}
          <span>{String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}</span>
        </div>
      </header>
      <GalleryScene slots={slots} direction={direction} activeVideo={file} motionPaused={motionPaused} onStep={step}
        onSelect={(id) => select(projects.findIndex((project) => project.id === id))}
        onVideoUnavailable={() => setVideoFallback(true)} onReady={setReady} />
      <div className="portfolio-console">
        <button type="button" aria-label="Previous project" disabled={count < 2} onClick={() => step(-1)}><ArrowLeft size={21} aria-hidden /></button>
        <span>Swipe or use the arrows to explore projects</span>
        <button type="button" aria-label="Next project" disabled={count < 2} onClick={() => step(1)}><ArrowRight size={21} aria-hidden /></button>
      </div>
    </div>
    <article className="portfolio-details panel stack" aria-live="polite">
      <div key={active.id} className="portfolio-detail-heading">
        <p className="portfolio-kicker">{active.sample ? "STUDIO SHOWCASE" : "FEATURED PROJECT"}</p>
        <h2>{active.title}</h2>
      </div>
      {active.summary && <p>{active.summary}</p>}
      {active.body && <p className="whitespace-pre-line">{active.body}</p>}
      <div className="row">
        {active.url && <a className="button button-primary" href={active.url} target={active.url.startsWith("/") ? undefined : "_blank"}
          rel="noopener noreferrer">Open project <ArrowUpRight size={17} aria-hidden /></a>}
        {video && <button className="button button-ghost" type="button" aria-pressed={showVideo} onClick={() => setShowVideo(!showVideo)}>
          {showVideo ? <Square size={16} aria-hidden /> : <Play size={16} aria-hidden />}
          {showVideo ? "Close video" : video.kind === "file" && ready ? "Play on gallery screen" : "Watch video"}
        </button>}
      </div>
      {file && <p className="small muted">Playing without sound on the gallery screen. <a className="text-link" href={file} target="_blank" rel="noopener noreferrer">Open video with sound</a></p>}
      {showVideo && video?.kind === "embed" && <iframe className="portfolio-video" src={video.url} title={`${active.title} video`}
        allow="fullscreen; picture-in-picture; encrypted-media" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />}
      {showVideo && video?.kind === "file" && !file && <video className="portfolio-video" controls playsInline src={video.url} poster={active.image || undefined} />}
    </article>
    <div className="portfolio-index" aria-label="Choose a project">
      {projects.map((project, number) => <button key={project.id} type="button" aria-pressed={number === index} onClick={() => select(number)}>
        {project.image ? <img src={project.image} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="portfolio-card-blank"><Box size={25} aria-hidden /></span>}
        <span><small>{String(number + 1).padStart(2, "0")}</small><strong>{project.title}</strong></span>
      </button>)}
    </div>
  </section>;
}
