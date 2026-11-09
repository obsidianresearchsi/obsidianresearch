"use client";

import { useRef, useState } from "react";
import { ArrowUpRight, BatteryCharging, Calculator, CirclePlus, MessageCircle, Plus, Sun, Trash2, Zap } from "lucide-react";
import { money } from "@/lib/model";
import { estimateSolar, LOAD_PRESETS, type Battery, type Load, type SolarPrices } from "@/lib/solar";
import { Eyebrow, Field } from "./ui";

type Row = { id: number; name: string; watts: string; quantity: string; hours: string; surge: string };
const limit = 12;
const format = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 2 });
const number = (value: string, min: number, max: number) =>
  value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max;

function readLoad(row: Row): Load | null {
  if (!row.name.trim() || !number(row.watts, 1, 25000) || !number(row.quantity, 1, 100) || !Number.isInteger(Number(row.quantity)) ||
    !number(row.hours, 0.1, 24) || !number(row.surge, 1, 8)) return null;
  return { name: row.name.trim().replace(/\s+/g, " "), watts: Number(row.watts), quantity: Number(row.quantity),
    hours: Number(row.hours), surge: Number(row.surge) };
}

export function SolarEstimator({ prices, whatsapp }: { prices: SolarPrices; whatsapp: string }) {
  const nextId = useRef(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [battery, setBattery] = useState<Battery>("lithium");
  const [panels, setPanels] = useState(true);
  const [installation, setInstallation] = useState(true);
  const [sun, setSun] = useState("4");
  const selected = rows.map(readLoad);
  const valid = selected.length > 0 && selected.every((load) => load !== null) && (!panels || number(sun, 1, 8));
  const loads = selected.filter((load): load is Load => load !== null);
  const estimate = valid ? estimateSolar(loads, battery, Number(sun), panels, installation, prices) : null;
  const batteryLabel = battery === "tubular" ? "Tubular lead-acid" : "LiFePO₄ lithium";

  function add(preset?: Omit<Load, "quantity">) {
    const id = ++nextId.current;
    const item = { id, name: preset?.name ?? "", watts: preset ? String(preset.watts) : "", quantity: "1",
      hours: String(preset?.hours ?? 4), surge: String(preset?.surge ?? 1) };
    setRows((current) => current.length < limit ? [...current, item] : current);
  }

  function change(id: number, field: Exclude<keyof Row, "id">, value: string) {
    setRows((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item));
  }

  let share: string | null = null;
  if (estimate) {
    const appliances = loads.map(({ name, quantity, watts, hours, surge }) => `• ${quantity} × ${name} · ${watts} W each · ${hours} h/day · startup ×${surge}`);
    const system = estimate.inverterWatts ? `${estimate.inverterWatts / 1000} kW hybrid · ${estimate.bankVoltage} V class` : "Custom inverter sizing";
    const total = estimate.total === null ? "Please quote after review" : `${money(estimate.total)} (budget estimate)`;
    const parts = estimate.custom ? "Please review a suitable system." : estimate.parts.map((item) =>
      `• ${item.quantity} × ${item.label} · ${money(item.quantity * item.price)}`).join("\n");
    const message = [
      "Hi Obsidian Research, please review my solar inverter estimate.",
      "", "Appliances", ...appliances, "",
      `Running load: ${format.format(estimate.watts)} W · Estimated startup: ${format.format(estimate.surge)} W`,
      `Backup use: ${format.format(estimate.wattHours / 1000)} kWh/day`,
      `Inverter: ${system}`, `Battery preference: ${batteryLabel}`,
      panels ? `Solar charging: ${sun} peak sun hours/day` : "Solar panels excluded",
      installation ? "Include basic installation" : "Equipment only", "", parts, `Estimated total: ${total}`,
    ].join("\n");
    share = `${whatsapp}?text=${encodeURIComponent(message)}`;
  }

  return <section className="solar-estimator" id="solar-estimator" aria-labelledby="solar-estimator-title">
    <header className="solar-estimator-header"><Eyebrow>Solar inverter planner</Eyebrow>
      <h2 id="solar-estimator-title">Size your backup power</h2>
      <p>Add the appliances you want to run, choose a battery, and get a budget estimate to review with our team.</p>
    </header>
    <div className="solar-estimator-grid">
      <div className="stack">
        <section className="panel stack"><div className="solar-step"><span>01</span><h3>Your appliances</h3></div>
          <p className="small muted">Tap to add. Replace the sample watts with the input rating on your appliance. For fridges and AC, use the hours they actually draw power.</p>
          <div className="solar-presets" aria-label="Appliance presets">
            {LOAD_PRESETS.map((preset) => <button key={preset.name} type="button" disabled={rows.length >= limit} onClick={() => add(preset)}>
              <Plus size={14} aria-hidden />{preset.name}
            </button>)}
          </div>
          {rows.map((item, index) => <fieldset key={item.id} className="solar-load">
            <legend>Appliance {index + 1}</legend>
            <div className="solar-load-heading">
              <Field label="Appliance name" value={item.name} maxLength={45} placeholder="e.g. Sewing machine" onChange={(event) => change(item.id, "name", event.target.value)} />
              <button type="button" className="solar-remove" aria-label={`Remove ${item.name || `appliance ${index + 1}`}`}
                onClick={() => setRows((current) => current.filter((row) => row.id !== item.id))}><Trash2 size={18} aria-hidden /></button>
            </div>
            <div className="solar-load-fields">
              <Field label="Quantity" type="number" inputMode="numeric" min={1} max={100} value={item.quantity} onChange={(e) => change(item.id, "quantity", e.target.value)} />
              <Field label="Watts each" type="number" inputMode="decimal" min={1} max={25000} step="any" value={item.watts} onChange={(e) => change(item.id, "watts", e.target.value)} />
              <Field label="Hours/day" type="number" inputMode="decimal" min={0.1} max={24} step="any" value={item.hours} onChange={(e) => change(item.id, "hours", e.target.value)} />
              <Field label="Startup ×" type="number" inputMode="decimal" min={1} max={8} step="any" value={item.surge} onChange={(e) => change(item.id, "surge", e.target.value)} />
            </div>
          </fieldset>)}
          <button type="button" className="button button-ghost" onClick={() => add()} disabled={rows.length >= limit}>
            <CirclePlus size={18} aria-hidden /> Add custom appliance
          </button>
          {rows.length >= limit && <p className="small muted">Group identical appliances using Quantity to keep the estimate within {limit} entries.</p>}
        </section>
        <section className="panel stack"><div className="solar-step"><span>02</span><h3>System preferences</h3></div>
          <fieldset className="solar-battery"><legend>Battery type</legend>
            <div>{(["lithium", "tubular"] as const).map((type) => <label key={type}>
              <input type="radio" name="solar-battery" checked={battery === type} onChange={() => setBattery(type)} />
              <span><strong>{type === "lithium" ? "Lithium" : "Tubular"}</strong><small>{type === "lithium" ? "LiFePO₄ · 5.12 kWh" : "Lead-acid · 12 V / 200 Ah"}</small></span>
            </label>)}</div>
          </fieldset>
          <label className="solar-toggle"><input type="checkbox" checked={panels} onChange={(event) => setPanels(event.target.checked)} />
            <Sun size={19} aria-hidden /> Include solar panels</label>
          {panels && <Field label="Peak sun hours per day" type="number" inputMode="decimal" min={1} max={8} step="any" value={sun}
            hint="4 is a planning assumption. Adjust it if you know the value for your site." onChange={(event) => setSun(event.target.value)} />}
          <label className="solar-toggle"><input type="checkbox" checked={installation} onChange={(event) => setInstallation(event.target.checked)} />
            Include basic installation</label>
          {estimate && <a className="button button-dark solar-jump" href="#solar-estimate-result">
            View estimate <ArrowUpRight size={16} aria-hidden />
          </a>}
        </section>
      </div>
      <aside className="solar-result panel stack" id="solar-estimate-result" aria-labelledby="solar-result-title">
        <div className="solar-step"><span>03</span><h3 id="solar-result-title">Your estimate</h3></div>
        {!estimate ? <div className="solar-empty"><Calculator size={28} aria-hidden /><p>{rows.length
          ? "Check the appliance values and sun hours to see your estimate."
          : "Add an appliance to see your running load, equipment and budget here."}</p></div> : <>
          <div className="solar-metrics">
            <div><Zap size={17} aria-hidden /><small>Running load</small><strong>{format.format(estimate.watts)} W</strong></div>
            <div><BatteryCharging size={17} aria-hidden /><small>Energy on backup</small><strong>{format.format(estimate.wattHours / 1000)} kWh/day</strong></div>
          </div>
          <p className="small muted">Estimated startup peak {format.format(estimate.surge)} W. Continuous inverter target {format.format(estimate.continuous)} W.</p>
          {estimate.total === null ? <p className="solar-custom"><strong>Custom system review</strong><br />Your load or battery bank is outside the standard packages. Share the details for a quote.</p> : <>
            <p className="small muted">{estimate.bankVoltage} V class system · {batteryLabel}</p>
            <dl className="solar-parts">{estimate.parts.map((item) => <div key={item.label}>
              <dt>{item.quantity} × {item.label}</dt><dd>{money(item.quantity * item.price)}</dd>
            </div>)}</dl>
            <div className="solar-total"><span>Budget estimate</span><strong>{money(estimate.total)}</strong></div>
          </>}
          {share && <a className="button solar-whatsapp" href={share} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={19} aria-hidden /> Review on WhatsApp <ArrowUpRight size={17} aria-hidden />
          </a>}
          <p className="small muted">WhatsApp opens a draft with your appliance list and estimate. You can review it before sending.</p>
        </>}
        <details className="solar-assumptions"><summary>What the estimate assumes</summary>
          <p>All listed appliances may run together, with one device starting at a time. The model allows 25% continuous headroom and estimates a brief surge rating of twice the inverter’s running capacity.</p>
          <p>It assumes 90% inverter efficiency, 80% usable lithium capacity, 50% usable tubular capacity, and 75% usable panel yield. We confirm battery discharge limits, equipment compatibility, site conditions, labour and final prices during review.</p>
        </details>
      </aside>
    </div>
  </section>;
}
