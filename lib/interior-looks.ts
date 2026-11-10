import type { InteriorDesign } from "./interior";

type Look = { title: string; group: "Kitchen" | "TV wall" | "Paint"; design: Partial<InteriorDesign> };
export const INTERIOR_LOOKS = [
  { title: "Walnut & ivory", group: "Kitchen", design: { cabinet: "shaker", palette: "amber", paint: "linen", wood: "hardwood" } },
  { title: "Sage family kitchen", group: "Kitchen", design: { cabinet: "shaker", palette: "sage", paint: "cream", wood: "plywood" } },
  { title: "Quiet charcoal", group: "Kitchen", design: { cabinet: "slab", palette: "dusk", paint: "linen" } },
  { title: "Warm fluted oak", group: "Kitchen", design: { cabinet: "fluted", palette: "amber", paint: "greige", wood: "plywood" } },
  { title: "Soft coastal kitchen", group: "Kitchen", design: { cabinet: "slab", palette: "sage", paint: "linen", accentPaint: "sage" } },
  { title: "Terracotta shaker", group: "Kitchen", design: { cabinet: "shaker", palette: "amber", accentPaint: "clay" } },
  { title: "Hotel walnut wall", group: "TV wall", design: { wall: "slats", palette: "amber", paint: "cream" } },
  { title: "Marble cinema wall", group: "TV wall", design: { wall: "stone", palette: "dusk", paint: "indigo", accentPaint: "linen" } },
  { title: "Floating sage gallery", group: "TV wall", design: { wall: "floating", palette: "sage", paint: "linen" } },
  { title: "Soft stone lounge", group: "TV wall", design: { wall: "stone", palette: "amber", paint: "greige" } },
  { title: "Dark timber & blue", group: "TV wall", design: { wall: "slats", palette: "dusk", paint: "indigo" } },
  { title: "Clay display wall", group: "TV wall", design: { wall: "floating", palette: "amber", paint: "clay" } },
  { title: "Quiet cream walls", group: "Paint", design: { paint: "cream", accentPaint: "linen", screed: "both" } },
  { title: "Olive & linen", group: "Paint", design: { paint: "linen", accentPaint: "sage", screed: "both" } },
  { title: "Sunset clay", group: "Paint", design: { paint: "cream", accentPaint: "clay", screed: "main" } },
  { title: "Midnight blue accent", group: "Paint", design: { paint: "greige", accentPaint: "indigo", screed: "both" } },
  { title: "Warm gallery white", group: "Paint", design: { paint: "linen", accentPaint: "linen", screed: "both" } },
  { title: "Earth & greige", group: "Paint", design: { paint: "clay", accentPaint: "greige", screed: "main" } },
] satisfies Look[];

export const QUORA_TOPICS = [
  "Small kitchen cabinet designs", "Shaker kitchen cabinets", "Fluted cabinets",
  "Floating TV units", "Modern TV wall panels", "Slatted living room walls",
  "Living room accent paint", "Two tone wall paint", "Wall screeding before painting",
];
