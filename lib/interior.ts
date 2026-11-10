import { z } from "zod";
import { money } from "./model";

export const INTERIOR_SERVICE = "interior-design";
export const INTERIOR_PLANNER = "/services/interior-design#interior-planner";
export const INTERIOR_RENDER_BUCKET = "interior-renders";

export const CABINETS = {
  slab: { label: "Modern slab", detail: "Smooth doors and minimal hardware", rate: 185_000 },
  shaker: { label: "Classic shaker", detail: "Framed panels and brushed pulls", rate: 230_000 },
  fluted: { label: "Fluted veneer", detail: "Vertical texture and warm grain", rate: 290_000 },
  twoTone: { label: "Two-tone modern", detail: "Light upper units and contrasting base cabinets", rate: 250_000 },
} as const;

export const TV_WALLS = {
  slats: { label: "Walnut slats", detail: "Vertical timber and soft accent lighting", rate: 410_000 },
  stone: { label: "Stone feature wall", detail: "Light marble and a floating console", rate: 620_000 },
  floating: { label: "Floating gallery", detail: "Painted panels and open display shelves", rate: 360_000 },
  framed: { label: "Framed cinema wall", detail: "Recessed screen and architectural border", rate: 475_000 },
} as const;

export const UNIT_FINISHES = {
  auto: { label: "Design finish", color: null },
  ivory: { label: "Ivory", color: "#ede2cd" },
  sage: { label: "Sage", color: "#71826f" },
  charcoal: { label: "Charcoal", color: "#404650" },
  walnut: { label: "Walnut", color: "#8b6248" },
  navy: { label: "Deep navy", color: "#33495f" },
} as const;

export const INTERIOR_EQUIPMENT = {
  sink: { label: "Sink and tap", rate: 120_000 },
  hob: { label: "Four-burner hob", rate: 180_000 },
  console: { label: "Floating media console", rate: 165_000 },
} as const;

export const TV_SIZES = ["43", "55", "65", "75"] as const;
const tvRates = { "43": 320_000, "55": 480_000, "65": 650_000, "75": 950_000 };

export const PALETTES = {
  amber: { label: "Warm walnut", wood: "#79503c", wall: "#e5d7c6", cabinet: "#9c745b", accent: "#b57b4c", stone: "#ddcbb5", fabric: "#c3ad92" },
  sage: { label: "Soft sage", wood: "#a17c5b", wall: "#e0e5d7", cabinet: "#61766a", accent: "#5e7361", stone: "#eee9dc", fabric: "#c8c7a7" },
  dusk: { label: "Midnight charcoal", wood: "#554941", wall: "#d9d8da", cabinet: "#323a45", accent: "#617289", stone: "#bbbcc1", fabric: "#888e9a" },
} as const;

export const INTERNET = {
  none: { label: "Skip internet", detail: "Use your current connection", rate: 0 },
  mini: { label: "Starlink Mini", detail: "Compact kit with built-in Wi-Fi", rate: 395_000 },
  standard: { label: "Starlink Standard V4", detail: "Standard dish and indoor router", rate: 620_000 },
} as const;

export const BACKUP = {
  none: { label: "Skip backup power", detail: "Use your current power setup", rate: 0 },
  tubular: { label: "1.5 kW tubular setup", detail: "Backup for essentials and lighting", rate: 825_000 },
  lithium: { label: "3 kW lithium setup", detail: "5.12 kWh lithium battery allowance", rate: 1_850_000 },
  hybrid: { label: "5 kW hybrid setup", detail: "5.12 kWh lithium battery allowance", rate: 2_250_000 },
} as const;

export const WOODS = {
  standard: { label: "Standard cabinet board", detail: "Included in the cabinet rate", rate: 0 },
  plywood: { label: "Plywood upgrade", detail: "Layered board with an oak finish", rate: 65_000 },
  hardwood: { label: "Hardwood upgrade", detail: "Deep walnut grain", rate: 135_000 },
} as const;

export const PAINTS = {
  cream: { label: "Soft cream", color: "#f0e3cd", rate: 5_500 },
  linen: { label: "Linen white", color: "#f4f0e6", rate: 5_500 },
  sage: { label: "Olive sage", color: "#899880", rate: 6_000 },
  clay: { label: "Terracotta clay", color: "#bd7d63", rate: 6_500 },
  indigo: { label: "Deep indigo", color: "#526380", rate: 7_000 },
  greige: { label: "Warm greige", color: "#bfb3a5", rate: 5_800 },
} as const;
type Paint = keyof typeof PAINTS;
const paintOptions = ["palette", "cream", "linen", "sage", "clay", "indigo", "greige"] as const;

export const INTERIOR_RATES = [
  ...Object.entries(CABINETS).map(([key, item]) => ({ key: `cabinet_${key}`, label: `${item.label} per metre`, naira: item.rate })),
  ...Object.entries(TV_WALLS).map(([key, item]) => ({ key: `wall_${key}`, label: `${item.label} per 2 m`, naira: item.rate })),
  ...Object.entries(INTERIOR_EQUIPMENT).map(([key, item]) => ({ key, label: item.label, naira: item.rate })),
  ...TV_SIZES.map((size) => ({ key: `tv_${size}`, label: `${size}-inch TV`, naira: tvRates[size] })),
  { key: "internet_mini", label: INTERNET.mini.label, naira: INTERNET.mini.rate },
  { key: "internet_standard", label: INTERNET.standard.label, naira: INTERNET.standard.rate },
  { key: "backup_tubular", label: BACKUP.tubular.label, naira: BACKUP.tubular.rate },
  { key: "backup_lithium", label: BACKUP.lithium.label, naira: BACKUP.lithium.rate },
  { key: "backup_hybrid", label: BACKUP.hybrid.label, naira: BACKUP.hybrid.rate },
  ...Object.entries(WOODS).filter(([key]) => key !== "standard").map(([key, item]) => ({
    key: `wood_${key}`, label: `${item.label} per metre`, naira: item.rate,
  })),
  ...Object.entries(PAINTS).map(([key, item]) => ({ key: `paint_${key}`, label: `${item.label} paint per m²`, naira: item.rate })),
  { key: "screed", label: "Wall screeding per m²", naira: 6_500 },
];

export const designSchema = z.object({
  cabinet: z.enum(Object.keys(CABINETS) as (keyof typeof CABINETS)[]),
  wall: z.enum(Object.keys(TV_WALLS) as (keyof typeof TV_WALLS)[]),
  palette: z.enum(["amber", "sage", "dusk"]),
  internet: z.enum(["none", "mini", "standard"]),
  backup: z.enum(["none", "tubular", "lithium", "hybrid"]),
  width: z.number().min(4).max(9).multipleOf(0.5),
  depth: z.number().min(4).max(8).multipleOf(0.5),
  includeCabinets: z.boolean(),
  includeWall: z.boolean(),
  wood: z.enum(["standard", "plywood", "hardwood"]).default("standard"),
  paint: z.enum(paintOptions).default("palette"),
  accentPaint: z.enum(paintOptions).default("palette"),
  screed: z.enum(["none", "main", "both"]).default("none"),
  cabinetFinish: z.enum(Object.keys(UNIT_FINISHES) as (keyof typeof UNIT_FINISHES)[]).default("auto"),
  tvFinish: z.enum(Object.keys(UNIT_FINISHES) as (keyof typeof UNIT_FINISHES)[]).default("auto"),
  cabinetLength: z.number().min(1.6).max(8.6).nullable().default(null),
  tvWallWidth: z.number().min(1.4).max(8.6).nullable().default(null),
  sink: z.boolean().default(false),
  hob: z.boolean().default(false),
  console: z.boolean().default(false),
  tvSize: z.enum(["none", ...TV_SIZES]).default("55"),
  supplyTv: z.boolean().default(false),
});
export type InteriorDesign = z.infer<typeof designSchema>;
export type InteriorPrices = Record<string, number>;
export const DEFAULT_DESIGN: InteriorDesign = {
  cabinet: "shaker", wall: "slats", palette: "amber", internet: "none", backup: "none",
  width: 6, depth: 5, includeCabinets: true, includeWall: true,
  wood: "standard", paint: "palette", accentPaint: "palette", screed: "none",
  cabinetFinish: "auto", tvFinish: "auto", cabinetLength: null, tvWallWidth: null,
  sink: false, hob: false, console: false, tvSize: "55", supplyTv: false,
};

export function interiorPrices(value: unknown): InteriorPrices {
  const saved = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(INTERIOR_RATES.map(({ key, naira }) => {
    const amount = saved[key];
    return [key, typeof amount === "number" && Number.isSafeInteger(amount) && amount >= 0 && amount <= 5_000_000_000
      ? amount : naira * 100];
  }));
}

export const MIN_CABINET = 1.6;
export const MIN_TV_WALL = 1.4;
const toTenth = (value: number) => Math.round(value * 10) / 10;

export function unitDimensions(design: InteriorDesign) {
  const available = design.width - (design.includeCabinets && design.includeWall ? 0.6 : 0.4);
  const cabinet = design.includeCabinets ? toTenth(Math.min(
    design.cabinetLength ?? toTenth(Math.min(5.4, design.width * 0.58)),
    available - (design.includeWall ? MIN_TV_WALL : 0),
  )) : 0;
  const wall = design.includeWall ? toTenth(Math.min(
    design.tvWallWidth ?? Math.max(MIN_TV_WALL, toTenth(Math.min(design.width * 0.33, 2.8))),
    available - cabinet,
  )) : 0;
  return { cabinet, wall, maxCabinet: toTenth(available - wall), maxWall: toTenth(available - cabinet) };
}

export function tvScreenWidth(size: string) {
  return Number(size) * 0.0254 * 16 / Math.hypot(16, 9);
}

export function fittedTv(design: InteriorDesign, wall: number) {
  return [...TV_SIZES].reverse().find((size) => Number(size) <= Number(design.tvSize) && tvScreenWidth(size) + 0.12 <= wall) ?? "none";
}

export function wallAreas(design: InteriorDesign) {
  return { main: design.width * 2.93, side: design.depth * (2.93 - 0.47 * 1.70) };
}

export function estimateInterior(design: InteriorDesign, prices: InteriorPrices) {
  const { cabinet: run, wall } = unitDimensions(design);
  const tv = fittedTv(design, wall);
  const parts = [];
  if (design.includeCabinets) parts.push({
    label: `${CABINETS[design.cabinet].label} cabinets · ${run} m`,
    price: Math.round(prices[`cabinet_${design.cabinet}`] * run),
  });
  if (design.includeCabinets && design.wood !== "standard") parts.push({
    label: `${WOODS[design.wood].label} · ${run} m`,
    price: Math.round(prices[`wood_${design.wood}`] * run),
  });
  if (design.includeWall) parts.push({
    label: `${TV_WALLS[design.wall].label} · ${wall} m`,
    price: Math.round(prices[`wall_${design.wall}`] * wall / 2),
  });
  for (const [key, equipment] of Object.entries(INTERIOR_EQUIPMENT)) {
    if ((key === "console" ? design.includeWall : design.includeCabinets) && design[key as keyof typeof INTERIOR_EQUIPMENT]) {
      parts.push({ label: equipment.label, price: prices[key] });
    }
  }
  if (design.supplyTv && tv !== "none") parts.push({ label: `${tv}-inch TV`, price: prices[`tv_${tv}`] });
  if (design.internet !== "none") parts.push({ label: INTERNET[design.internet].label, price: prices[`internet_${design.internet}`] });
  if (design.backup !== "none") parts.push({ label: BACKUP[design.backup].label, price: prices[`backup_${design.backup}`] });
  const areas = wallAreas(design);
  const paintLine = (paint: Paint, area: number, surface: string) => ({
    label: `${PAINTS[paint].label} · ${surface} · ${area.toFixed(1)} m²`,
    price: Math.round(prices[`paint_${paint}`] * area),
  });
  if (design.paint !== "palette") parts.push(paintLine(design.paint, areas.main, "main wall"));
  if (design.accentPaint !== "palette") parts.push(paintLine(design.accentPaint, areas.side, "window wall"));
  if (design.screed !== "none") {
    const area = areas.main + (design.screed === "both" ? areas.side : 0);
    parts.push({ label: `Wall screeding · ${area.toFixed(1)} m²`, price: Math.round(prices.screed * area) });
  }
  return { parts, total: parts.reduce((sum, item) => sum + item.price, 0) };
}

export function interiorBrief(design: InteriorDesign, prices: InteriorPrices) {
  const { parts, total } = estimateInterior(design, prices);
  const tv = fittedTv(design, unitDimensions(design).wall);
  return [
    "Interior design concept for review",
    `Room: ${design.width} × ${design.depth} m · ${PALETTES[design.palette].label}`,
    ...(design.includeCabinets ? [`Cabinet finish: ${UNIT_FINISHES[design.cabinetFinish].label}`] : []),
    ...(design.includeWall ? [`TV wall finish: ${UNIT_FINISHES[design.tvFinish].label}`] : []),
    ...(tv !== "none" && !design.supplyTv ? [`Existing TV in preview: ${tv} inches`] : []),
    ...parts.map(({ label, price }) => `• ${label} · ${money(price)}`),
    `Budget estimate: ${money(total)}`,
    "Please confirm the layout, measurements, installation and final quote.",
  ].join("\n");
}
