import { equipmentName, type StudioEquipment } from "./studio-equipment";

export const SOLAR_SERVICE = "solar-power";
export const SOLAR_ESTIMATOR = "/services/solar-power#solar-estimator";
export const PANEL_WATTS = 550;
export const BATTERY_OPTIONS = [
  { key: "lithium25", title: "2.5 kWh", label: "2.56 kWh lithium module", kwh: 2.56, voltage: 24, usable: 0.8, naira: 600_000 },
  { key: "lithium", title: "5.12 kWh", label: "5.12 kWh lithium module", kwh: 5.12, voltage: 48, usable: 0.8, naira: 1_200_000 },
  { key: "lithium8", title: "8 kWh", label: "8 kWh lithium module", kwh: 8, voltage: 48, usable: 0.8, naira: 1_600_000 },
  { key: "lithium10", title: "10.24 kWh", label: "10.24 kWh lithium module", kwh: 10.24, voltage: 48, usable: 0.8, naira: 1_900_000 },
  { key: "lithium15", title: "15.36 kWh", label: "15.36 kWh lithium module", kwh: 15.36, voltage: 48, usable: 0.8, naira: 2_400_000 },
  { key: "lithium20", title: "20.48 kWh", label: "20.48 kWh lithium module", kwh: 20.48, voltage: 48, usable: 0.8, naira: 3_200_000 },
  { key: "tubular", title: "Tubular", label: "12 V / 200 Ah tubular battery", kwh: 2.4, voltage: 12, usable: 0.5, naira: 250_000 },
] as const;
export type Battery = (typeof BATTERY_OPTIONS)[number]["key"];

export const SOLAR_RATES = [
  { key: "inverter1500", label: "1.5 kW hybrid inverter", naira: 300_000 },
  { key: "inverter3000", label: "3 kW hybrid inverter (24 V or 48 V)", naira: 550_000 },
  { key: "inverter5000", label: "5 kW hybrid inverter", naira: 850_000 },
  { key: "inverter8000", label: "8 kW hybrid inverter", naira: 1_300_000 },
  { key: "inverter12000", label: "12 kW hybrid inverter", naira: 1_850_000 },
  ...BATTERY_OPTIONS,
  { key: "panel", label: "550 W solar panel", naira: 125_000 },
  { key: "installation", label: "Basic installation allowance", naira: 200_000 },
] as const;

type RateKey = (typeof SOLAR_RATES)[number]["key"];
export type SolarPrices = Record<RateKey, number>;
export type Load = { name: string; watts: number; quantity: number; hours: number; surge: number };

export type Appliance = Omit<Load, "quantity"> & { id: string; group: string };
export const APPLIANCE_GROUPS = ["Lights & fans", "Screens & internet", "Cooling", "Kitchen", "Utility"] as const;
const appliance = (id: string, name: string, group: typeof APPLIANCE_GROUPS[number], watts: number, hours: number, surge = 1): Appliance =>
  ({ id, name, group, watts, hours, surge });
export const LOAD_PRESETS = [
  appliance("led", "LED bulb", "Lights & fans", 10, 6),
  appliance("downlight", "LED downlight", "Lights & fans", 7, 5),
  appliance("outdoor", "Outdoor light", "Lights & fans", 30, 8),
  appliance("fan", "Standing fan", "Lights & fans", 65, 6, 2),
  appliance("ceiling_fan", "Ceiling fan", "Lights & fans", 75, 6, 2),
  appliance("tv", "LED TV", "Screens & internet", 100, 4),
  appliance("decoder", "TV decoder", "Screens & internet", 15, 4),
  appliance("console", "Gaming console", "Screens & internet", 180, 2),
  appliance("laptop", "Laptop", "Screens & internet", 65, 4),
  appliance("desktop", "Desktop PC and monitor", "Screens & internet", 250, 4),
  appliance("phone", "Phone charger", "Screens & internet", 15, 2),
  appliance("router", "Wi-Fi router", "Screens & internet", 12, 8),
  appliance("starlink_mini", "Starlink Mini", "Screens & internet", 40, 8),
  appliance("starlink_standard", "Starlink Standard", "Screens & internet", 100, 8),
  appliance("cctv", "CCTV recorder and cameras", "Screens & internet", 55, 8),
  appliance("fridge", "Fridge", "Cooling", 150, 6, 3),
  appliance("freezer", "Chest freezer", "Cooling", 200, 6, 3),
  appliance("ac1", "1 HP air conditioner", "Cooling", 900, 4, 3),
  appliance("ac15", "1.5 HP air conditioner", "Cooling", 1200, 4, 3),
  appliance("ac2", "2 HP air conditioner", "Cooling", 1700, 4, 3),
  appliance("microwave", "Microwave", "Kitchen", 1200, 0.5),
  appliance("kettle", "Electric kettle", "Kitchen", 1800, 0.2),
  appliance("blender", "Blender", "Kitchen", 400, 0.2, 2),
  appliance("air_fryer", "Air fryer", "Kitchen", 1500, 0.5),
  appliance("rice", "Rice cooker", "Kitchen", 700, 1),
  appliance("dispenser", "Water dispenser", "Kitchen", 500, 1),
  appliance("pump", "Water pump", "Utility", 750, 1, 3),
  appliance("washer", "Washing machine", "Utility", 500, 1, 2),
  appliance("iron", "Iron", "Utility", 1200, 0.5),
  appliance("printer", "Inkjet printer", "Utility", 50, 0.5),
  appliance("sewing", "Sewing machine", "Utility", 100, 3, 2),
];

export function solarAppliances(raw: unknown) {
  const saved = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return LOAD_PRESETS.map((item) => {
    const watts = saved[item.id];
    return typeof watts === "number" && Number.isInteger(watts) && watts >= 1 && watts <= 25_000 ? { ...item, watts } : item;
  });
}

const INVERTERS = [
  { watts: 1500, rate: "inverter1500", voltages: [24] },
  { watts: 3000, rate: "inverter3000", voltages: [24, 48] },
  { watts: 5000, rate: "inverter5000", voltages: [48] },
  { watts: 8000, rate: "inverter8000", voltages: [48] },
  { watts: 12000, rate: "inverter12000", voltages: [48] },
] as const;

export function solarPrices(raw: unknown): SolarPrices {
  const saved = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return Object.fromEntries(SOLAR_RATES.map(({ key, naira }) => {
    const amount = saved[key];
    return [key, typeof amount === "number" && Number.isSafeInteger(amount) && amount >= 0 && amount <= 5_000_000_000
      ? amount : naira * 100];
  })) as SolarPrices;
}

export function estimateSolar(loads: Load[], battery: Battery, sunHours: number, panels: boolean, installation: boolean, prices: SolarPrices, model?: StudioEquipment) {
  const option = BATTERY_OPTIONS.find(({ key }) => key === battery)!;
  const tubular = battery === "tubular";
  const watts = loads.reduce((total, load) => total + load.watts * load.quantity, 0);
  const wattHours = loads.reduce((total, load) => total + load.watts * load.quantity * load.hours, 0);
  // Assume all listed devices can run at once, with the largest device starting at that moment.
  const surge = watts + Math.max(0, ...loads.map((load) => load.watts * (load.surge - 1)));
  const continuous = Math.ceil(watts * 1.25);
  const sizedInverters = INVERTERS.filter((item) => item.watts >= continuous && item.watts * 2 >= surge);
  const available = sizedInverters.find((item) => tubular || item.voltages.some((voltage) => voltage === option.voltage));
  const inverter = model
    ? model.kind==="inverter" && model.watts && model.surge_watts && model.voltage &&
      model.watts>=continuous && model.surge_watts>=surge && (tubular || model.voltage===option.voltage)
      ? { watts:model.watts, voltages:[model.voltage], label:equipmentName(model), price:model.price_kobo } : undefined
    : available ? { ...available, label:`${available.watts/1000} kW hybrid inverter`, price:prices[available.rate] } : undefined;
  const bankVoltage = tubular ? inverter?.voltages[0] ?? 48 : option.voltage;
  const inverterEfficiency = 0.9;
  const batteriesPerString = tubular ? bankVoltage / 12 : 1;
  const stringWh = option.kwh * 1000 * option.usable * inverterEfficiency * batteriesPerString;
  // Use planning limits for lithium discharge until the actual battery and BMS are confirmed.
  const dischargeStrings = tubular ? 0 : Math.ceil(Math.max(watts / 0.5, surge) / (option.kwh * 1000 * inverterEfficiency));
  const batteries = Math.max(Math.ceil(wattHours / stringWh), dischargeStrings) * batteriesPerString;
  const runtimeHours = watts > 0 ? (batteries / batteriesPerString) * stringWh / watts : 0;
  const panelCount = panels ? Math.ceil(wattHours / (PANEL_WATTS * sunHours * 0.75)) : 0;
  // Larger banks and arrays need a custom design and equipment compatibility review.
  const reason = !inverter
    ? model ? "The selected model does not meet this load, surge or battery-voltage requirement. Choose another model or use automatic sizing."
      : sizedInverters.length ? "Choose a 48 V battery for this load, or ask our team about a custom setup." : "This load needs a larger inverter than the standard options."
    : batteries > batteriesPerString * (tubular ? 3 : 6) ? "This selection needs a larger battery bank than the standard options."
    : panelCount > 24 ? "This selection needs a larger solar array than the standard options." : null;
  const custom = reason !== null;
  const parts = [
    ...(inverter ? [{ label: inverter.label, quantity: 1, price: inverter.price }] : []),
    { label: option.label, quantity: batteries, price: prices[battery] },
    ...(panelCount ? [{ label: "550 W solar panel", quantity: panelCount, price: prices.panel }] : []),
    ...(installation ? [{ label: "Basic installation", quantity: 1, price: prices.installation }] : []),
  ];
  const subtotal = parts.reduce((total, item) => total + item.quantity * (item.price ?? 0), 0);
  const pending = parts.some((item) => item.price === null);
  return { watts, wattHours, runtimeHours, surge, continuous, inverterWatts: inverter?.watts, inverterLabel:inverter?.label,
    bankVoltage, batteries, panelCount, parts, custom, reason, pending, subtotal,
    bankKwh: batteries * option.kwh,
    total: custom || pending ? null : subtotal };
}
