export const SOLAR_SERVICE = "solar-power";
export const PANEL_WATTS = 550;
export const SOLAR_RATES = [
  { key: "inverter1500", label: "1.5 kW hybrid inverter", naira: 300_000 },
  { key: "inverter3000", label: "3 kW hybrid inverter", naira: 550_000 },
  { key: "inverter5000", label: "5 kW hybrid inverter", naira: 850_000 },
  { key: "inverter8000", label: "8 kW hybrid inverter", naira: 1_300_000 },
  { key: "inverter12000", label: "12 kW hybrid inverter", naira: 1_850_000 },
  { key: "tubular", label: "12 V / 200 Ah tubular battery", naira: 250_000 },
  { key: "lithium", label: "51.2 V / 5.12 kWh LiFePO₄ module", naira: 1_200_000 },
  { key: "panel", label: "550 W solar panel", naira: 125_000 },
  { key: "installation", label: "Basic installation allowance", naira: 200_000 },
] as const;

type RateKey = (typeof SOLAR_RATES)[number]["key"];
export type SolarPrices = Record<RateKey, number>;
export type Battery = "tubular" | "lithium";
export type Load = { name: string; watts: number; quantity: number; hours: number; surge: number };

export const LOAD_PRESETS = [
  { name: "LED bulb", watts: 10, hours: 6, surge: 1 },
  { name: "TV", watts: 100, hours: 4, surge: 1 },
  { name: "Fan", watts: 65, hours: 6, surge: 2 },
  { name: "Laptop", watts: 65, hours: 4, surge: 1 },
  { name: "Desktop PC", watts: 250, hours: 4, surge: 1 },
  { name: "Phone charger", watts: 15, hours: 2, surge: 1 },
  { name: "Wi-Fi router", watts: 12, hours: 8, surge: 1 },
  { name: "Starlink", watts: 75, hours: 6, surge: 1 },
  { name: "Fridge", watts: 150, hours: 6, surge: 3 },
  { name: "Freezer", watts: 200, hours: 6, surge: 3 },
  { name: "Air conditioner", watts: 1200, hours: 4, surge: 3 },
  { name: "Water pump", watts: 750, hours: 1, surge: 3 },
  { name: "Iron", watts: 1200, hours: 0.5, surge: 1 },
  { name: "Microwave", watts: 1200, hours: 0.5, surge: 1 },
] satisfies Omit<Load, "quantity">[];

const INVERTERS = [
  { watts: 1500, rate: "inverter1500" },
  { watts: 3000, rate: "inverter3000" },
  { watts: 5000, rate: "inverter5000" },
  { watts: 8000, rate: "inverter8000" },
  { watts: 12000, rate: "inverter12000" },
] as const;

export function solarPrices(raw: unknown): SolarPrices {
  const saved = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return Object.fromEntries(SOLAR_RATES.map(({ key, naira }) => {
    const amount = saved[key];
    return [key, typeof amount === "number" && Number.isSafeInteger(amount) && amount >= 0 && amount <= 5_000_000_000
      ? amount : naira * 100];
  })) as SolarPrices;
}

export function estimateSolar(loads: Load[], battery: Battery, sunHours: number, panels: boolean, installation: boolean, prices: SolarPrices) {
  const watts = loads.reduce((total, load) => total + load.watts * load.quantity, 0);
  const wattHours = loads.reduce((total, load) => total + load.watts * load.quantity * load.hours, 0);
  // Assume all listed devices can run at once, with the largest device starting at that moment.
  const surge = watts + Math.max(0, ...loads.map((load) => load.watts * (load.surge - 1)));
  const continuous = Math.ceil(watts * 1.25);
  const inverter = INVERTERS.find((item) => item.watts >= continuous && item.watts * 2 >= surge &&
    (battery !== "lithium" || item.watts >= 3000));
  const bankVoltage = battery === "lithium" || !inverter || inverter.watts >= 5000 ? 48 : 24;
  const batteryKwh = battery === "lithium" ? 5.12 : 2.4;
  const usableFraction = battery === "lithium" ? 0.8 : 0.5;
  const inverterEfficiency = 0.9;
  const batteriesPerString = battery === "tubular" ? bankVoltage / 12 : 1;
  const stringWh = batteryKwh * 1000 * usableFraction * inverterEfficiency * batteriesPerString;
  const batteries = Math.ceil(wattHours / stringWh) * batteriesPerString;
  const panelCount = panels ? Math.ceil(wattHours / (PANEL_WATTS * sunHours * 0.75)) : 0;
  // Larger banks and arrays need a custom design and equipment compatibility review.
  const custom = !inverter || (battery === "tubular" && batteries > batteriesPerString * 3) ||
    (battery === "lithium" && batteries > 6) || panelCount > 24;
  const parts = [
    ...(inverter ? [{ label: `${inverter.watts / 1000} kW hybrid inverter`, quantity: 1, price: prices[inverter.rate] }] : []),
    { label: battery === "tubular" ? "200 Ah tubular battery" : "5.12 kWh lithium module", quantity: batteries, price: prices[battery] },
    ...(panelCount ? [{ label: "550 W solar panel", quantity: panelCount, price: prices.panel }] : []),
    ...(installation ? [{ label: "Basic installation", quantity: 1, price: prices.installation }] : []),
  ];
  return { watts, wattHours, surge, continuous, inverterWatts: inverter?.watts, bankVoltage, batteries, panelCount, parts, custom,
    total: custom ? null : parts.reduce((total, item) => total + item.quantity * item.price, 0) };
}
