"use client";

import { useRef, useState } from "react";
import { ArrowUpRight, BatteryCharging, Calculator, CirclePlus, Clock3, Download, MessageCircle, Plus, Sun, Trash2, Zap } from "lucide-react";
import { money } from "@/lib/model";
import { APPLIANCE_GROUPS, BATTERY_OPTIONS, estimateSolar, type Appliance, type Battery, type Load, type SolarPrices } from "@/lib/solar";
import { Eyebrow, Field } from "./ui";
import { StudioScreen } from "./studio-screen";
import { equipmentImage, equipmentName, type StudioEquipment } from "@/lib/studio-equipment";

type Row = { id: number; preset: string | null; name: string; watts: string; quantity: string; hours: string; surge: string };
type RowField = "name" | "watts" | "quantity" | "hours" | "surge";
const limit = 20;
const format = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 2 });
const number = (value: string, min: number, max: number) =>
  value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max;

function readLoad(row: Row): Load | null {
  if (!row.name.trim() || !number(row.watts, 1, 25000) || !number(row.quantity, 1, 100) || !Number.isInteger(Number(row.quantity)) ||
    !number(row.hours, 0.1, 24) || !number(row.surge, 1, 8)) return null;
  return { name: row.name.trim().replace(/\s+/g, " "), watts: Number(row.watts), quantity: Number(row.quantity),
    hours: Number(row.hours), surge: Number(row.surge) };
}

function backupTime(hours: number) {
  const minutes = Math.floor(hours * 60);
  if (minutes < 1) return "Less than a minute";
  const whole = Math.floor(minutes / 60);
  return [whole ? `${whole} hr` : "", minutes % 60 ? `${minutes % 60} min` : ""].filter(Boolean).join(" ");
}

export function SolarEstimator({ prices, appliances, whatsapp, equipment }: { prices: SolarPrices; appliances: Appliance[]; whatsapp: string; equipment: StudioEquipment[] }) {
  const nextId = useRef(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [battery, setBattery] = useState<Battery>("lithium");
  const [panels, setPanels] = useState(true);
  const [installation, setInstallation] = useState(true);
  const [sun, setSun] = useState("4");
  const [modelId,setModelId] = useState("");
  const [pdfStatus,setPdfStatus] = useState("");
  const [exporting,setExporting] = useState(false);
  const [group, setGroup] = useState<typeof APPLIANCE_GROUPS[number]>("Screens & internet");
  const selected = rows.map(readLoad);
  const valid = selected.length > 0 && selected.every((load) => load !== null) && (!panels || number(sun, 1, 8));
  const loads = selected.filter((load): load is Load => load !== null);
  const model = equipment.find((item) => item.id===modelId);
  const batteryChoices = BATTERY_OPTIONS.map((option) => ({
    option,
    estimate: valid ? estimateSolar(loads, option.key, Number(sun), panels, installation, prices, model) : null,
  }));
  const chosen = batteryChoices.find(({ option }) => option.key === battery)!;
  const estimate = chosen.estimate;
  const batteryLabel = chosen.option.label;

  function add(preset?: Appliance) {
    const id = ++nextId.current;
    const item = { id, preset: preset?.id ?? null, name: preset?.name ?? "", watts: preset ? String(preset.watts) : "", quantity: "1",
      hours: String(preset?.hours ?? 4), surge: String(preset?.surge ?? 1) };
    setRows((current) => current.length < limit ? [...current, item] : current);
  }

  function change(id: number, field: RowField, value: string) {
    setRows((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item));
  }

  async function exportPdf() {
    if (!estimate || estimate.custom || exporting) return;
    setExporting(true);
    setPdfStatus("");
    try {
      const [{ createSolarPdf },{ downloadQuote }] = await Promise.all([import("@/lib/solar-pdf"),import("@/lib/quote-pdf")]);
      downloadQuote(await createSolarPdf(estimate,loads),"obsidian-solar-inverter-quote.pdf");
      setPdfStatus("Your branded quote is ready.");
    } catch { setPdfStatus("Could not prepare the PDF. Please try again."); }
    finally { setExporting(false); }
  }

  let share: string | null = null;
  if (estimate) {
    const appliances = loads.map(({ name, quantity, watts, hours, surge }) => `• ${quantity} × ${name} · ${watts} W each · ${hours} h/day · startup ×${surge}`);
    const system = estimate.inverterWatts ? `${estimate.inverterLabel} · ${estimate.bankVoltage} V class` : "Custom inverter sizing";
    const total = estimate.custom ? "Please quote after review" : `${money(estimate.subtotal)} (${estimate.pending ? "priced subtotal" : "budget estimate"})`;
    const parts = estimate.custom ? estimate.reason : estimate.parts.map((item) =>
      `• ${item.quantity} × ${item.label} · ${item.price===null ? "Quote required" : money(item.quantity * item.price)}`).join("\n");
    const message = [
      "Hi Obsidian Research, please review my solar inverter estimate.",
      "", "Appliances", ...appliances, "",
      `Running load: ${format.format(estimate.watts)} W · Estimated startup: ${format.format(estimate.surge)} W`,
      `Backup use: ${format.format(estimate.wattHours / 1000)} kWh/day`,
      ...(!estimate.custom ? [`Estimated time with everything running: ${backupTime(estimate.runtimeHours)}`] : []),
      `Inverter: ${system}`, `Battery preference: ${batteryLabel}`,
      ...(!estimate.custom ? [`Battery bank: ${estimate.batteries} units · ${format.format(estimate.bankKwh)} kWh rated`] : []),
      panels ? `Solar charging: ${sun} peak sun hours/day` : "Solar panels excluded",
      installation ? "Include basic installation" : "Equipment only", "", parts, `Estimated total: ${total}`,
    ].join("\n");
    share = `${whatsapp}?text=${encodeURIComponent(message)}`;
  }

  return <section className="solar-estimator" id="solar-estimator" aria-labelledby="solar-estimator-title">
    <StudioScreen label="Solar & Inverter Planner">{() => <>
    <header className="solar-estimator-header"><Eyebrow>Solar inverter planner</Eyebrow>
      <h2 id="solar-estimator-title">Size your backup power</h2>
      <p>Pick what needs to stay on, compare battery sizes, and see how long your setup could last in a power cut.</p>
    </header>
    <div className="solar-estimator-grid">
      <div className="stack">
        <section className="panel stack"><div className="solar-step"><span>01</span><h3>Your appliances</h3></div>
          <p className="small muted">Choose the appliances you want to keep on. We fill in a typical wattage and starting hours. Adjust the number of appliances and how long you need them on.</p>
          <div className="solar-presets solar-groups" aria-label="Appliance categories">
            {APPLIANCE_GROUPS.map((name) => <button type="button" key={name} aria-pressed={name === group} onClick={() => setGroup(name)}>{name}</button>)}
          </div>
          <div className="solar-presets" aria-label="Appliance presets">
            {appliances.filter((preset) => preset.group === group).map((preset) => {
              const row = rows.find((item) => item.preset === preset.id);
              return <button key={preset.id} type="button" aria-pressed={Boolean(row)} disabled={!row && rows.length >= limit}
                onClick={() => row ? setRows((current) => current.filter((item) => item.id !== row.id)) : add(preset)}>
                {row ? "✓" : <Plus size={14} aria-hidden />}{preset.name} <small>{preset.watts} W</small>
              </button>;
            })}
          </div>
          {rows.map((item, index) => <fieldset key={item.id} className="solar-load">
            <legend>Appliance {index + 1}</legend>
            <div className="solar-load-heading">
              {item.preset ? <strong>{item.name} <span className="small muted">· {item.watts || "—"} W each</span></strong> :
                <Field label="Appliance name" value={item.name} maxLength={45} placeholder="e.g. Sewing machine" onChange={(event) => change(item.id, "name", event.target.value)} />}
              <button type="button" className="solar-remove" aria-label={`Remove ${item.name || `appliance ${index + 1}`}`}
                onClick={() => setRows((current) => current.filter((row) => row.id !== item.id))}><Trash2 size={18} aria-hidden /></button>
            </div>
            <div className="solar-load-fields">
              <Field label="Quantity" type="number" inputMode="numeric" min={1} max={100} value={item.quantity} onChange={(e) => change(item.id, "quantity", e.target.value)} />
              <Field label="Hours you need it on" type="number" inputMode="decimal" min={0.1} max={24} step="any" value={item.hours} onChange={(e) => change(item.id, "hours", e.target.value)} />
            </div>
            <details className="solar-load-details" open={item.preset ? undefined : true}>
              <summary>{item.preset ? "Edit power rating" : "Power rating"}</summary>
              <div className="solar-load-fields">
                <Field label="Watts each" type="number" inputMode="decimal" min={1} max={25000} step="any" value={item.watts} onChange={(e) => change(item.id, "watts", e.target.value)} />
                <Field label="Startup multiplier" type="number" inputMode="decimal" min={1} max={8} step="any" value={item.surge} onChange={(e) => change(item.id, "surge", e.target.value)} />
              </div>
            </details>
          </fieldset>)}
          <button type="button" className="button button-ghost" onClick={() => add()} disabled={rows.length >= limit}>
            <CirclePlus size={18} aria-hidden /> Add custom appliance
          </button>
          {rows.length >= limit && <p className="small muted">Group identical appliances using Quantity to keep the estimate within {limit} entries.</p>}
        </section>
        <section className="panel stack solar-system"><div className="solar-step"><span>02</span><h3>Build your backup system</h3></div>
          {equipment.length>0 && <label className="field"><span>Inverter model</span><select value={modelId} onChange={(event)=>setModelId(event.target.value)}>
            <option value="">Size automatically</option>
            {equipment.map((item)=><option key={item.id} value={item.id}>{equipmentName(item)} · {(item.watts ?? 0)/1000} kW · {item.voltage} V</option>)}
          </select></label>}
          {model && equipmentImage(model) && <img className="equipment-thumbnail" src={equipmentImage(model)} alt={equipmentName(model)} loading="lazy" />}
          <fieldset className="solar-battery">
            <legend>Choose a battery</legend>
            <p className="small muted">Prices are per unit. We calculate how many units you need. Add appliances to compare backup times.</p>
            <div className="solar-battery-grid">{batteryChoices.map(({ option, estimate: comparison }) => <label className="solar-battery-card" key={option.key}>
              <span className="solar-battery-title">
                <input type="radio" name="solar-battery" checked={battery === option.key} onChange={() => setBattery(option.key)} />
                <strong>{option.title}</strong>
              </span>
              <small>{option.key === "tubular" ? "Lead-acid · 12 V / 200 Ah" : `LiFePO₄ · ${option.voltage} V class`}</small>
              <span className="solar-unit-price">{money(prices[option.key])} <small>/ unit</small></span>
              {comparison && <span className="solar-battery-comparison">
                {comparison.custom ? "Needs review" : `${comparison.batteries} ${comparison.batteries === 1 ? "unit" : "units"} · ${backupTime(comparison.runtimeHours)}`}
              </span>}
            </label>)}</div>
          </fieldset>
          <div className="solar-add-ons">
          <label className="solar-toggle"><input type="checkbox" checked={panels} onChange={(event) => setPanels(event.target.checked)} />
            <Sun size={19} aria-hidden /> Include solar panels</label>
          {panels && <Field label="Peak sun hours per day" type="number" inputMode="decimal" min={1} max={8} step="any" value={sun}
            hint="4 is a planning assumption. Adjust it if you know the value for your site." onChange={(event) => setSun(event.target.value)} />}
          <label className="solar-toggle"><input type="checkbox" checked={installation} onChange={(event) => setInstallation(event.target.checked)} />
            Include basic installation</label>
          </div>
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
          <div className="solar-runtime">
            <span><Clock3 size={17} aria-hidden /> Estimated backup time</span>
            <strong>{estimate.custom ? "Ask our team" : backupTime(estimate.runtimeHours)}</strong>
            {!estimate.custom && <p>From a full charge with everything listed running together and no power coming in.</p>}
          </div>
          <div className="solar-metrics">
            <div><Zap size={17} aria-hidden /><small>Running load</small><strong>{format.format(estimate.watts)} W</strong></div>
            {!estimate.custom && <div><BatteryCharging size={17} aria-hidden /><small>Total battery capacity</small>
              <strong>{format.format(estimate.bankKwh)} kWh</strong><small>{estimate.batteries} {estimate.batteries === 1 ? "unit" : "units"} · {estimate.bankVoltage} V class</small>
            </div>}
          </div>
          {estimate.custom ? <p className="solar-custom"><strong>Custom system review</strong><br />{estimate.reason}</p> : <>
            <h4 className="solar-parts-heading">Equipment & costs</h4>
            <dl className="solar-parts">{estimate.parts.map((item) => <div key={item.label}>
              <dt>{item.quantity} × {item.label}</dt><dd>{item.price===null ? "Quote required" : money(item.quantity * item.price)}</dd>
            </div>)}</dl>
            <div className="solar-total"><span>{estimate.pending ? "Priced subtotal" : "Budget estimate"}</span><strong>{money(estimate.subtotal)}</strong></div>
            <button className="button button-dark" type="button" onClick={exportPdf} disabled={exporting}>
              <Download size={17} aria-hidden /> {exporting ? "Preparing quote…" : "Download branded PDF"}</button>
            {pdfStatus && <p className="small" role="status">{pdfStatus}</p>}
          </>}
          {share && <a className="button solar-whatsapp" href={share} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={19} aria-hidden /> Review on WhatsApp <ArrowUpRight size={17} aria-hidden />
          </a>}
          <p className="small muted">WhatsApp opens a draft with your appliance list and estimate. You can review it before sending.</p>
        </>}
        <details className="solar-assumptions"><summary>What the estimate assumes</summary>
          <p>Watts show how much power something draws while it is on. A 100 W TV running for 10 hours uses one unit of electricity, called 1 kWh. For a fridge or AC, enter the hours you expect it to actively draw power.</p>
          {estimate && <p>Your selections use about {format.format(estimate.wattHours / 1000)} kWh for the hours entered. The estimated startup peak is {format.format(estimate.surge)} W.</p>}
          <p>All listed appliances may run together, with one device starting at a time. The model allows 25% continuous headroom and estimates a brief surge rating of twice the inverter’s running capacity.</p>
          <p>It assumes 90% inverter efficiency, 80% usable lithium capacity, 50% usable tubular capacity, and 75% usable panel yield. We confirm battery discharge limits, equipment compatibility, site conditions, labour and final prices during review.</p>
        </details>
      </aside>
    </div>
    </>}</StudioScreen>
  </section>;
}
