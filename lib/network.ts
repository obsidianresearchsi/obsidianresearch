import { z } from "zod";
import { equipmentName, type StudioEquipment } from "./studio-equipment";

export const NETWORK_SERVICE = "advanced-networking";
export const NETWORK_STUDIO = "/services/advanced-networking#network-studio";
export const NETWORK_LIMIT = 16;
export const NETWORK_DEVICES = {
  v4: { name: "Starlink Standard V4", short: "Starlink V4", role: "uplink", radius: 0, outputs: 1 },
  mini: { name: "Starlink Mini", short: "Starlink Mini", role: "uplink", radius: 0, outputs: 1 },
  mikrotik: { name: "MikroTik router", short: "MikroTik", role: "gateway", radius: 0, outputs: 4 },
  switch: { name: "PoE switch", short: "PoE switch", role: "distribution", radius: 0, outputs: 7 },
  grandstream: { name: "Grandstream GWN7630LR", short: "Grandstream AP", role: "ap", radius: 300, outputs: 0 },
  tplink: { name: "TP-Link Omada EAP610-Outdoor", short: "TP-Link AP", role: "ap", radius: 300, outputs: 0 },
  wavlink: { name: "Wavlink WL-WN570HA2", short: "Wavlink AP", role: "ap", radius: 200, outputs: 0 },
} as const;
const deviceKinds = Object.keys(NETWORK_DEVICES) as (keyof typeof NETWORK_DEVICES)[];
export const NETWORK_RATES = [
  { key: "v4", label: NETWORK_DEVICES.v4.name, naira: 550_000 },
  { key: "mini", label: NETWORK_DEVICES.mini.name, naira: 350_000 },
  { key: "dish_install", label: "Starlink installation per dish", naira: 55_000 },
  { key: "deployment", label: "Advanced network configuration and deployment", naira: 200_000 },
  { key: "mikrotik", label: NETWORK_DEVICES.mikrotik.name, naira: null },
  { key: "switch", label: NETWORK_DEVICES.switch.name, naira: null },
  { key: "grandstream", label: NETWORK_DEVICES.grandstream.name, naira: null },
  { key: "tplink", label: NETWORK_DEVICES.tplink.name, naira: null },
  { key: "wavlink", label: NETWORK_DEVICES.wavlink.name, naira: null },
  { key: "bridge", label: "Ubiquiti LiteBeam 5AC Gen2 radio", naira: null },
  { key: "cable", label: "Ethernet cable per metre", naira: null },
] as const;

type RateKey = (typeof NETWORK_RATES)[number]["key"];
export type NetworkPrices = Record<RateKey, number | null>;
export const ENVIRONMENTS = { open: "Open outdoor site", mixed: "Trees and light obstructions", dense: "Walls and dense obstructions" } as const;
const environmentKeys = ["open", "mixed", "dense"] as const;
const deviceSchema = z.object({
  id: z.number().int().min(1).max(9999),
  kind: z.enum(deviceKinds),
  modelId: z.uuid().optional(),
  x: z.number().min(4).max(96),
  y: z.number().min(5).max(95),
});
const linkSchema = z.discriminatedUnion("kind", [
  z.object({ from: deviceSchema.shape.id, to: deviceSchema.shape.id, kind: z.literal("cable"), metres: z.number().int().min(1).max(2000).nullable() }),
  z.object({ from: deviceSchema.shape.id, to: deviceSchema.shape.id, kind: z.literal("bridge"), km: z.number().int().min(5).max(15), clear: z.boolean() }),
]);
export type NetworkDevice = z.infer<typeof deviceSchema>;
export type NetworkLink = z.infer<typeof linkSchema>;
export const equipmentDeviceKind = { ap:"grandstream", router:"mikrotik", switch:"switch" } as const;

export function connectionIssue(devices: NetworkDevice[], links: NetworkLink[], from: number, to: number) {
  const source = devices.find((device) => device.id === from);
  const target = devices.find((device) => device.id === to);
  if (!source || !target || from === to) return "Choose two different devices.";
  if (NETWORK_DEVICES[target.kind].role === "uplink") return "Starlink starts a network path. Choose a router, switch or AP as the destination.";
  if (links.some((link) => link.to === to)) return "This device already has an upstream connection.";
  if (links.filter((link) => link.from === from).length >= NETWORK_DEVICES[source.kind].outputs) {
    return NETWORK_DEVICES[source.kind].role === "ap" ? "An access point ends this path. Use a router or switch upstream." : "No free downstream port remains. Add a switch.";
  }
  let upstream: number | undefined = from;
  const visited = new Set<number>();
  while (upstream !== undefined) {
    if (upstream === to || visited.has(upstream)) return "This connection would create a loop.";
    visited.add(upstream);
    upstream = links.find((link) => link.to === upstream)?.from;
  }
  return null;
}

export const networkPlanSchema = z.object({
  site: z.number().int().min(50).max(1200),
  environment: z.enum(environmentKeys),
  sky: z.boolean(),
  voucher: z.boolean(),
  install: z.boolean(),
  deployment: z.boolean(),
  devices: z.array(deviceSchema).max(NETWORK_LIMIT),
  links: z.array(linkSchema).max(NETWORK_LIMIT - 1),
}).superRefine((plan, ctx) => {
  if (new Set(plan.devices.map(({ id }) => id)).size !== plan.devices.length) {
    ctx.addIssue({ code: "custom", message: "Device IDs must be unique." });
    return;
  }
  const accepted: NetworkLink[] = [];
  for (const link of plan.links) {
    const error = connectionIssue(plan.devices, accepted, link.from, link.to);
    if (error) ctx.addIssue({ code: "custom", message: error });
    else accepted.push(link);
  }
});

export type NetworkPlan = z.infer<typeof networkPlanSchema>;
export const DEFAULT_NETWORK: NetworkPlan = {
  site: 250, environment: "open", sky: true, voucher: true, install: true, deployment: true,
  devices: [
    { id: 1, kind: "v4", x: 18, y: 37 }, { id: 2, kind: "mikrotik", x: 39, y: 46 },
    { id: 3, kind: "grandstream", x: 62, y: 30 }, { id: 4, kind: "tplink", x: 65, y: 67 },
  ],
  links: [
    { from: 1, to: 2, kind: "cable", metres: null },
    { from: 2, to: 3, kind: "cable", metres: null },
    { from: 2, to: 4, kind: "cable", metres: null },
  ],
};

export function networkPrices(raw: unknown): NetworkPrices {
  const saved = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return Object.fromEntries(NETWORK_RATES.map(({ key, naira }) => {
    const price = saved[key];
    const fallback = naira === null ? null : naira * 100;
    return [key, price === null || (typeof price === "number" && Number.isSafeInteger(price) && price >= 0 && price <= 5_000_000_000)
      ? price : fallback];
  })) as NetworkPrices;
}

export function cableLength(plan: NetworkPlan, link: Extract<NetworkLink, { kind: "cable" }>) {
  const from = plan.devices.find(({ id }) => id === link.from);
  const to = plan.devices.find(({ id }) => id === link.to);
  if (!from || !to) return 0;
  const distance = Math.ceil(Math.hypot(from.x - to.x, from.y - to.y) * plan.site / 100);
  return Math.max(1, distance, link.metres ?? 0);
}

export function simulateNetwork(plan: NetworkPlan) {
  const routes = new Map<number, number[]>();
  if (plan.sky) for (const device of plan.devices) {
    if (NETWORK_DEVICES[device.kind].role === "uplink") routes.set(device.id, [device.id]);
  }
  const links = plan.links.map((link) => {
    const metres = link.kind === "cable" ? cableLength(plan, link) : link.km * 1000;
    const warning = link.kind === "bridge" ? (!link.clear ? "Line of sight not confirmed" : null)
      : metres > 100 ? "Cable exceeds the 100 m planning limit" : null;
    return { link, metres, warning };
  });
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const { link, warning } of links) {
      const path = routes.get(link.from);
      if (path && !warning && !routes.has(link.to)) {
        routes.set(link.to, [...path, link.to]);
        progressed = true;
      }
    }
  }
  return { routes, links };
}

export function coverageSite(plan: NetworkPlan, deviceId: number) {
  let upstream = plan.links.find((link) => link.to === deviceId);
  while (upstream) {
    if (upstream.kind === "bridge") return upstream.to;
    const parent = upstream.from;
    upstream = plan.links.find((link) => link.to === parent);
  }
  return 0;
}

export function signalAt(plan: NetworkPlan, x: number, y: number, enabled: Set<number>, models: StudioEquipment[] = []) {
  const environment = { open: { scale: 1, loss: 0 }, mixed: { scale: 1.3, loss: 4 }, dense: { scale: 1.58, loss: 8 } }[plan.environment];
  let strongest: { device: NetworkDevice; dbm: number } | null = null;
  for (const device of plan.devices) {
    const radius = device.modelId ? models.find((item) => item.id === device.modelId)?.radius_m ?? 0 : NETWORK_DEVICES[device.kind].radius;
    if (!radius || !enabled.has(device.id)) continue;
    const metres = Math.max(1, Math.hypot(device.x - x, device.y - y) * plan.site / 100);
    const dbm = -40 - 38 * environment.scale * Math.log10(metres) / Math.log10(radius) - environment.loss;
    if (!strongest || strongest.dbm < dbm) strongest = { device, dbm };
  }
  return strongest;
}

export function coverageBand(dbm: number): "strong" | "usable" | "weak" | null {
  if (dbm >= -65) return "strong";
  if (dbm >= -78) return "usable";
  if (dbm >= -85) return "weak";
  return null;
}

export function estimateNetwork(plan: NetworkPlan, prices: NetworkPrices, models: StudioEquipment[] = []) {
  const quantities: Partial<Record<RateKey, number>> = {};
  const custom = new Map<string,number>();
  for (const { kind,modelId } of plan.devices) {
    if (modelId) custom.set(modelId,(custom.get(modelId) ?? 0)+1);
    else quantities[kind] = (quantities[kind] ?? 0) + 1;
  }
  if (plan.install) quantities.dish_install = (quantities.v4 ?? 0) + (quantities.mini ?? 0);
  if (plan.deployment && plan.devices.length) quantities.deployment = 1;
  quantities.bridge = plan.links.filter(({ kind }) => kind === "bridge").length * 2;
  quantities.cable = plan.links.reduce((total, link) => total + (link.kind === "cable" ? cableLength(plan, link) : 0), 0);
  const parts: {key:string;label:string;quantity:number;price:number|null;total:number|null}[] = NETWORK_RATES.flatMap(({ key, label }) => {
    const quantity = quantities[key] ?? 0;
    const price = prices[key];
    return quantity ? [{ key, label, quantity, price, total: price === null ? null : price * quantity }] : [];
  });
  for (const [id,quantity] of custom) {
    const model = models.find((item) => item.id === id);
    const price = model?.price_kobo ?? null;
    parts.push({ key:id, label:model ? equipmentName(model) : "Unavailable equipment model", quantity, price,
      total:price === null ? null : price * quantity });
  }
  return { parts, subtotal: parts.reduce((total, part) => total + (part.total ?? 0), 0), pending: parts.filter((part) => part.total === null).length };
}

export const networkNaira = (kobo: number) => new Intl.NumberFormat("en-NG", { maximumFractionDigits: 2 }).format(kobo / 100);
export function deviceLabel(device: NetworkDevice, models: StudioEquipment[] = []) {
  const model = models.find((item) => item.id === device.modelId);
  return `#${device.id} ${model ? equipmentName(model) : device.modelId ? "Unavailable model" : NETWORK_DEVICES[device.kind].short}`;
}

export function networkBrief(plan: NetworkPlan, prices: NetworkPrices, models: StudioEquipment[] = []) {
  const quote = estimateNetwork(plan, prices, models);
  const simulation = simulateNetwork(plan);
  return [
    "Network design for Obsidian Research review",
    `Site: ${plan.site} m × ${plan.site} m · ${ENVIRONMENTS[plan.environment]}`,
    `Topology: ${plan.devices.length} devices · ${plan.links.length} links · ${simulation.routes.size} reachable devices`,
    `Starlink sky view: ${plan.sky ? "assumed clear" : "obstructed in simulation"} · Voucher portal: ${plan.voucher ? "requested" : "off"}`,
    "",
    ...quote.parts.map(({ quantity, label, total }) => `• ${quantity} × ${label} · ${total === null ? "Quote required" : `₦${networkNaira(total)}`}`),
    `${quote.pending ? "Priced subtotal" : "Budget estimate"}: ₦${networkNaira(quote.subtotal)}`,
    ...(quote.pending ? [`${quote.pending} line items still require pricing.`] : []),
    "Please confirm equipment, power, site conditions, subscription and final costs.",
  ].join("\n");
}
