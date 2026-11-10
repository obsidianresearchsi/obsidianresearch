"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, Download, MapPin, MessageCircle, Plus, Radio, Send, Wifi } from "lucide-react";
import { submitNetworkReview } from "@/app/services/network-actions";
import {
  cableLength, connectionIssue, coverageBand, coverageSite, DEFAULT_NETWORK, deviceLabel, ENVIRONMENTS, equipmentDeviceKind, estimateNetwork,
  NETWORK_DEVICES, NETWORK_LIMIT, NETWORK_STUDIO, networkBrief, networkNaira, networkPlanSchema, signalAt,
  simulateNetwork, type NetworkDevice, type NetworkLink, type NetworkPlan, type NetworkPrices,
} from "@/lib/network";
import { NetworkMap, SatelliteScene } from "./network-map";
import { StudioScreen } from "./studio-screen";
import { BandwidthPlanner } from "./bandwidth-planner";
import { equipmentImage, equipmentName, type StudioEquipment } from "@/lib/studio-equipment";
import type { NetworkViewProps } from "@/lib/network-view";
import type { QuoteContact } from "@/lib/quote-pdf";

const NetworkScene=dynamic(()=>import("./network-scene"),{ssr:false,
  loading:()=> <div className="network-three-canvas network-three-loading" role="status">Loading the Three.js network…</div>,
});
const draftKey = "obsidian.network.draft.v1";
const demoCode = "OBSIDIAN-DEMO";
const starterProbe = { x: 73, y: 42 };
const validId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
type Receipt = { owner: string; thread: string };

function HotspotPreview({ reachable, granted, onGrant, onReset }: {
  reachable: boolean; granted: boolean; onGrant: () => void; onReset: () => void;
}) {
  const [code, setCode] = useState("");
  const [invalid, setInvalid] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reachable) return;
    if (code.trim().toUpperCase() === demoCode) {
      onGrant();
      setInvalid(false);
    } else setInvalid(true);
  }
  return <div className="network-hotspot">
    <div className="network-hotspot-brand"><Wifi size={22} aria-hidden /><div><strong>Obsidian Guest Wi-Fi</strong><small>Captive portal demo</small></div></div>
    {!reachable ? <p>Move the test client into strong or usable Wi-Fi on a path that includes a reachable MikroTik gateway.</p>
      : granted ? <><p role="status"><strong>Voucher accepted.</strong> This test client can now reach the internet through the gateway.</p>
        <button type="button" className="button button-ghost" onClick={() => { onReset(); setCode(""); }}>End demo session</button></>
        : <form className="stack" onSubmit={submit}>
          <label className="field"><span>Guest voucher</span><input value={code} onChange={(event) => { setCode(event.target.value); setInvalid(false); }}
            autoComplete="off" maxLength={30} placeholder={demoCode} required /></label>
          <small>Try <strong>{demoCode}</strong>. No real router, account or voucher is contacted.</small>
          {invalid && <p role="alert">That demo code is incorrect.</p>}
          <button className="button button-primary" type="submit">Connect with voucher</button>
        </form>}
  </div>;
}

function newPosition(devices: NetworkDevice[]) {
  for (const y of [23, 43, 65, 83]) for (const x of [15, 34, 55, 75, 88]) {
    if (devices.every((device) => Math.hypot(device.x - x, device.y - y) >= 12)) return { x, y };
  }
  return { x: 50, y: 50 };
}

export function NetworkStudio({ prices, whatsapp, accountId, reviewPlan, equipment, quoteContact }: {
  prices: NetworkPrices; whatsapp: string; accountId: string | null; reviewPlan?: NetworkPlan; equipment: StudioEquipment[];quoteContact:QuoteContact;
}) {
  const [plan, setPlan] = useState(reviewPlan ?? DEFAULT_NETWORK);
  const [ready, setReady] = useState(Boolean(reviewPlan));
  const [saved, setSaved] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [placing, setPlacing] = useState(false);
  const [probe, setProbe] = useState(starterProbe);
  const [viewedSite, setViewedSite] = useState(0);
  const [mode, setMode] = useState<"three"|"map">("three");
  const [unavailable, setUnavailable] = useState(false);
  const [granted, setGranted] = useState(false);
  const [source, setSource] = useState(2);
  const [target, setTarget] = useState(0);
  const [linkKind, setLinkKind] = useState<NetworkLink["kind"]>("cable");
  const [connectionFeedback, setConnectionFeedback] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState<"pdf" | "review" | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const submission = useRef<string | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (reviewPlan) return;
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey) ?? "null");
      const parsed = networkPlanSchema.safeParse(draft?.plan);
      if (parsed.success) setPlan(parsed.data);
      if (validId(draft?.receipt?.owner) && validId(draft?.receipt?.thread)) setReceipt(draft.receipt);
    } catch { /* The example topology remains available. */ }
    setReady(true);
  }, [reviewPlan]);
  useEffect(() => {
    if (!ready || reviewPlan) return;
    try { localStorage.setItem(draftKey, JSON.stringify({ plan, receipt })); setSaved(true); }
    catch { setSaved(false); }
  }, [plan, ready, receipt, reviewPlan]);

  const simulation = useMemo(() => simulateNetwork(plan), [plan]);
  const remoteSites = plan.links.filter((link) => link.kind === "bridge").map((link) => link.to);
  const site = remoteSites.includes(viewedSite) ? viewedSite : 0;
  const enabled = useMemo(() => new Set(plan.devices.filter(({ id }) => coverageSite(plan,id) === site).map(({ id }) => id)), [plan, site]);
  const signal = signalAt(plan, probe.x, probe.y, enabled, equipment);
  const band = signal && coverageBand(signal.dbm);
  const clientRoute = signal && (band === "strong" || band === "usable") ? simulation.routes.get(signal.device.id) ?? [] : [];
  const gateway = clientRoute.find((id) => plan.devices.some((device) => device.id === id && device.kind === "mikrotik"));
  const clientOnline = clientRoute.length > 0 && (!plan.voucher || (gateway !== undefined && granted));
  const primaryDish = plan.devices.find(({ kind }) => kind === "v4" || kind === "mini");
  const quote = estimateNetwork(plan, prices, equipment);
  const brief = networkBrief(plan, prices, equipment);
  const active = plan.devices.find(({ id }) => id === selected);
  const ownedReceipt = receipt?.owner === accountId ? receipt : null;
  const editable = ready && busy === null && !reviewPlan;
  const findDevice = (id: number) => plan.devices.find((device) => device.id === id);
  const label = (id: number) => { const device = findDevice(id); return device ? deviceLabel(device,equipment) : `#${id}`; };
  const customerUrl = `/account?next=${encodeURIComponent(NETWORK_STUDIO)}`;

  function edit(next: NetworkPlan) {
    setPlan(next);
    submission.current = null;
    setGranted(false);
    setStatus("");
    setConnectionFeedback("");
  }

  function addDevice(kind: NetworkDevice["kind"], modelId?: string) {
    if (!editable || plan.devices.length >= NETWORK_LIMIT) return;
    let id = 1;
    while (plan.devices.some((device) => device.id === id)) id++;
    edit({ ...plan, devices: [...plan.devices, { id, kind, modelId, ...newPosition(plan.devices) }] });
    setSelected(id);
    setPlacing(false);
    setTarget(id);
  }

  function place(x: number, y: number) {
    if (placing && active && editable) {
      edit({ ...plan, devices: plan.devices.map((device) => device.id === selected ? { ...device, x, y } : device) });
      setPlacing(false);
    } else {
      setProbe({ x, y });
      setGranted(false);
    }
  }

  function connect() {
    const error = connectionIssue(plan.devices, plan.links, source, target);
    if (error) { setConnectionFeedback(error); return; }
    const link: NetworkLink = linkKind === "bridge" ? { from: source, to: target, kind: "bridge", km: 5, clear: false }
      : { from: source, to: target, kind: "cable", metres: null };
    edit({ ...plan, links: [...plan.links, link] });
    setConnectionFeedback(`Connected ${label(source)} to ${label(target)}.`);
  }

  function changeLink(next: NetworkLink) {
    edit({ ...plan, links: plan.links.map((link) => link.to === next.to ? next : link) });
  }

  async function download() {
    if (inFlight.current || !quote.parts.length) return;
    inFlight.current = true;
    setBusy("pdf");
    setStatus("");
    try {
      const [{ createNetworkPdf },{ downloadQuote }] = await Promise.all([import("@/lib/network-pdf"),import("@/lib/quote-pdf")]);
      downloadQuote(await createNetworkPdf(plan,prices,equipment,quoteContact),"obsidian-network-quote.pdf");
      setStatus("Your PDF quote is ready.");
    } catch { setStatus("The PDF could not be created. Try again or share the estimate on WhatsApp."); }
    finally { setBusy(null); inFlight.current = false; }
  }

  async function send() {
    if (!accountId || reviewPlan || !quote.parts.length || inFlight.current) return;
    inFlight.current = true;
    setBusy("review");
    setStatus("");
    try {
      const data = new FormData();
      submission.current ??= crypto.randomUUID();
      data.set("id", submission.current);
      data.set("plan", JSON.stringify(plan));
      data.set("notes", notes);
      const result = await submitNetworkReview(data);
      if (!result.thread) { setStatus(result.error ?? "Could not send this design."); return; }
      setReceipt({ owner: accountId, thread: result.thread });
      setStatus("Design sent. Track the reply in My Workspace.");
    } catch { setStatus("Could not send this design. Try again."); }
    finally { setBusy(null); inFlight.current = false; }
  }

  const viewProps:NetworkViewProps={plan,simulation,coverageDevices:enabled,equipment,selected,probe,placing,path:clientOnline?clientRoute:[],
    onSelect:(id)=>{setSelected(id);setPlacing(false);},onPoint:place};
  return <section className="network-studio" id="network-studio" aria-labelledby="network-title">
    <StudioScreen label="Network Studio">{(expanded) => <>
    <header className="network-studio-intro">
      <p className="network-kicker">OBSIDIAN RESEARCH / NETWORK PLANNING</p>
      <h2 id="network-title">{reviewPlan ? "Submitted network design" : "Network Studio"}</h2>
      <p>{reviewPlan ? "Inspect the submitted topology, coverage and quote." : "Lay out your equipment, connect it, and see where Wi-Fi reaches before you request a quote."}</p>
      <div className="network-badges"><span><Radio size={16} aria-hidden /> Coverage simulation</span><span>{reviewPlan ? "Review mode" : ready && saved ? "Draft saved on this device" : ready ? "Draft storage unavailable" : "Opening draft…"}</span></div>
    </header>

    {mode==="map" && <SatelliteScene hasDish={Boolean(primaryDish)} sky={plan.sky} />}
    <div className="network-layout">
      <section className="panel stack network-map-panel" aria-labelledby="network-map-title">
        <div><h3 id="network-map-title">Live topology & coverage</h3>
          <p className="small muted">{placing ? "Tap a clear spot to move the selected device." : "Tap a device to select it. Tap an empty spot to test Wi-Fi."}</p>
        </div>
        <div className="network-view-mode" aria-label="Network view">
          <button type="button" aria-pressed={mode==="three"} onClick={()=>{setUnavailable(false);setMode("three");}}>3D simulator</button>
          <button type="button" aria-pressed={mode==="map"} onClick={()=>setMode("map")}>2D placement map</button>
        </div>
        {unavailable && <p className="small network-warning" role="status">3D is unavailable on this device. The 2D map still supports equipment placement and coverage testing.</p>}
        {remoteSites.length > 0 && <label className="field"><span>Wi-Fi coverage site</span>
          <select value={site} onChange={(event) => { setViewedSite(Number(event.target.value)); setGranted(false); }}>
            <option value={0}>Main site</option>
            {remoteSites.map((id) => <option key={id} value={id}>Remote site · {label(id)}</option>)}
          </select></label>}
        {mode==="three" ? <NetworkScene {...viewProps} expanded={expanded} onUnavailable={()=>{setUnavailable(true);setMode("map");}} />
          : <NetworkMap {...viewProps} />}
        {mode==="three" && <p className="small muted">
          {primaryDish && plan.sky ? "The orbit and dish beam illustrate satellite handoff. Moving dots show active traffic paths." :
            primaryDish ? "The dish beam is off because sky obstruction is selected." : "Add a Starlink kit to see the satellite uplink."}
        </p>}
        <div className="network-client-status">
          <div><MapPin size={17} aria-hidden /><strong>Test client</strong></div>
          <span>{signal && band ? `${band} Wi-Fi · ${Math.round(signal.dbm)} dBm · ${label(signal.device.id)}` : "Outside modelled Wi-Fi coverage"}</span>
          <span>{clientOnline ? `Online · ${clientRoute.map(label).join(" → ")} → client`
            : clientRoute.length ? plan.voucher && gateway === undefined ? "Voucher gateway missing on this path" : "Wi-Fi connected · waiting for voucher"
              : "No usable internet path at this point"}</span>
        </div>
        <details className="solar-assumptions"><summary>Set the test client position</summary>
          <div className="network-inputs">
            {(["x", "y"] as const).map((axis) => <label className="field" key={axis}>
              <span>{axis === "x" ? "Across site" : "Down site"}</span>
              <input type="range" min={axis === "x" ? 4 : 5} max={axis === "x" ? 96 : 95} value={probe[axis]}
                onChange={(event) => { setProbe({ ...probe, [axis]: Number(event.target.value) }); setGranted(false); }} />
            </label>)}
          </div>
        </details>
        <p className="small muted">Coverage assumes the APs have power and uses distance and the obstruction setting. Each bridged site has its own Wi-Fi preview. Connections between sites are schematic. A survey confirms measured coverage, interference and capacity.</p>
      </section>
      <section className="panel stack network-editor">
        <fieldset className="network-fields stack" disabled={!editable}>
          <legend>01 / Site & equipment</legend>
          <div className="network-inputs">
            <label className="field"><span>Square site size (metres)</span>
              <input type="range" min={50} max={1200} step={10} value={plan.site} aria-valuetext={`${plan.site} metres per side`}
                onChange={(event) => edit({ ...plan, site: Number(event.target.value) })} /><strong>{plan.site} × {plan.site} m</strong></label>
            <label className="field"><span>Environment</span><select value={plan.environment}
              onChange={(event) => edit({ ...plan, environment: event.target.value as NetworkPlan["environment"] })}>
              {Object.entries(ENVIRONMENTS).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
          </div>
          {primaryDish && <label className="field"><span>Primary Starlink kit</span>
            <select value={primaryDish.kind} onChange={(event) => {
              const kind = event.target.value === "mini" ? "mini" : "v4";
              edit({ ...plan, devices: plan.devices.map((device) => device.id === primaryDish.id ? { ...device, kind } : device) });
            }}><option value="v4">Standard V4</option><option value="mini">Mini</option></select>
          </label>}
          <label className="network-check"><input type="checkbox" checked={plan.sky} onChange={(event) => edit({ ...plan, sky: event.target.checked })} /> Clear sky view for Starlink</label>
          <div className="network-equipment">
            {(Object.keys(NETWORK_DEVICES) as NetworkDevice["kind"][]).map((kind) => <button type="button" key={kind} title={NETWORK_DEVICES[kind].name}
              disabled={plan.devices.length >= NETWORK_LIMIT} onClick={() => addDevice(kind)}>
              <Plus size={16} aria-hidden /><span><strong>{NETWORK_DEVICES[kind].short}</strong>
                {NETWORK_DEVICES[kind].radius > 0 && <small>{NETWORK_DEVICES[kind].radius} m open-site reference</small>}
                <small>{prices[kind] === null ? "Quote required" : `₦${networkNaira(prices[kind])}`}</small></span>
            </button>)}
            {equipment.flatMap((item) => {
              if (item.kind==="inverter") return [];
              const kind = equipmentDeviceKind[item.kind];
              return [<button type="button" key={item.id} disabled={plan.devices.length>=NETWORK_LIMIT} onClick={() => addDevice(kind,item.id)}>
                {equipmentImage(item) ? <img className="equipment-thumbnail" src={equipmentImage(item)} alt="" loading="lazy" /> : <Plus size={16} aria-hidden />}
                <span><strong>{equipmentName(item)}</strong>{item.radius_m && <small>{item.radius_m} m planning reference</small>}
                  <small>{item.price_kobo===null ? "Quote required" : `₦${networkNaira(item.price_kobo)}`}</small></span>
              </button>];
            })}
          </div>
          {plan.devices.length >= NETWORK_LIMIT && <p className="small muted">The plan supports up to {NETWORK_LIMIT} devices.</p>}
          <label className="field"><span>Select placed equipment</span><select value={selected ?? ""}
            onChange={(event) => { setSelected(Number(event.target.value) || null); setPlacing(false); }}>
            <option value="">Choose equipment</option>
            {plan.devices.map((device) => <option value={device.id} key={device.id}>{deviceLabel(device,equipment)}</option>)}</select></label>
          {active && <div className="network-device-controls">
            <div className="row">
              <button type="button" className="button button-ghost" aria-pressed={placing} onClick={() => {
                setPlacing(!placing);
                if (!placing && window.matchMedia("(max-width: 760px)").matches) document.getElementById("network-map-title")?.scrollIntoView();
              }}>{placing ? "Cancel placement" : "Move on map"}</button>
              <button type="button" className="button button-ghost" onClick={() => {
                edit({ ...plan, devices: plan.devices.filter(({ id }) => id !== active.id),
                  links: plan.links.filter((link) => link.from !== active.id && link.to !== active.id) });
                setSelected(null);
                setPlacing(false);
              }}>Remove device</button>
            </div>
            <div className="network-inputs">
              {(["x", "y"] as const).map((axis) => <label className="field" key={axis}>
                <span>{axis === "x" ? "Position across site" : "Position down site"}</span>
                <input type="range" min={axis === "x" ? 4 : 5} max={axis === "x" ? 96 : 95} value={active[axis]}
                  onChange={(event) => edit({ ...plan, devices: plan.devices.map((device) =>
                    device.id === active.id ? { ...device, [axis]: Number(event.target.value) } : device) })} />
              </label>)}
            </div>
          </div>}
        </fieldset>
        <fieldset className="network-fields stack" disabled={!editable}>
          <legend>02 / Add a connection</legend>
          <div className="network-inputs">
            {([["Upstream device", source, setSource], ["Downstream device", target, setTarget]] as const).map(([title, value, setter]) =>
              <label className="field" key={title}><span>{title}</span><select value={findDevice(value) ? value : 0} onChange={(event) => setter(Number(event.target.value))}>
                <option value={0}>Choose equipment</option>{plan.devices.map((device) => <option value={device.id} key={device.id}>{deviceLabel(device,equipment)}</option>)}
              </select></label>)}
          </div>
          <label className="field"><span>Connection type</span><select value={linkKind} onChange={(event) => setLinkKind(event.target.value as NetworkLink["kind"])}>
            <option value="cable">Wired Ethernet</option><option value="bridge">Wireless bridge · LiteBeam pair</option></select></label>
          <button className="button button-dark" type="button" disabled={!findDevice(source) || !findDevice(target)} onClick={connect}>Connect devices</button>
          {connectionFeedback && <p className="small" role="status">{connectionFeedback}</p>}
        </fieldset>
      </section>
    </div>

    <BandwidthPlanner online={plan.devices.some((device) => device.kind === "mikrotik" && simulation.routes.has(device.id))} />
    <div className="network-bottom">
      <section className="panel stack">
        <h3>Connections & guest Wi-Fi</h3>
        <fieldset className="network-fields stack" disabled={!editable}>
          <legend>Connection details</legend>
          {simulation.links.length ? simulation.links.map(({ link, warning }) => <div className="network-link-item" key={link.to}>
            <strong>{label(link.from)} → {label(link.to)}</strong>
            {link.kind === "cable" ? <label className="field">
              <span>Ethernet · {cableLength(plan, link)} m modelled</span>
              <input type="number" min={1} max={2000} value={link.metres ?? ""} placeholder="Use map distance"
                onChange={(event) => {
                  const raw = event.target.value;
                  const value = Number(raw);
                  if (raw === "" || (Number.isInteger(value) && value >= 1 && value <= 2000)) changeLink({ ...link, metres: raw ? value : null });
                }} />
            </label> : <>
              <label className="field"><span>LiteBeam bridge distance</span><select value={link.km}
                onChange={(event) => changeLink({ ...link, km: Number(event.target.value) })}>
                {Array.from({ length: 11 }, (_, index) => index + 5).map((km) => <option key={km} value={km}>{km} km</option>)}</select></label>
              <label className="network-check"><input type="checkbox" checked={link.clear}
                onChange={(event) => changeLink({ ...link, clear: event.target.checked })} /> Assume clear line of sight for this demo</label>
              <small>Two radios per link. Confirm mounting heights, path clearance, signal margin and local limits during survey.</small>
            </>}
            <p className={warning ? "network-warning" : "small muted"}>{warning ?? (simulation.routes.has(link.to) ? "Traffic path active" : "Waiting for an upstream connection")}</p>
            <button type="button" className="network-text-button" onClick={() => edit({ ...plan, links: plan.links.filter(({ to }) => to !== link.to) })}>Remove connection</button>
          </div>) : <p className="small muted">Connect a Starlink kit to a gateway, then connect an access point.</p>}
          <label className="network-check"><input type="checkbox" checked={plan.voucher} onChange={(event) => edit({ ...plan, voucher: event.target.checked })} /> Require a MikroTik voucher for guest access</label>
        </fieldset>
        {plan.voucher && <HotspotPreview reachable={gateway !== undefined} granted={granted}
          onGrant={() => setGranted(true)} onReset={() => setGranted(false)} />}
        {!reviewPlan && <button type="button" className="network-text-button" disabled={!editable}
          onClick={() => { edit(DEFAULT_NETWORK); setProbe(starterProbe); setSelected(null); setPlacing(false); setSource(2); setTarget(0); }}>Restore example topology</button>}
      </section>

      <section className="panel stack network-quote" aria-labelledby="network-quote-title">
        <h3 id="network-quote-title">Itemized network quote</h3>
        <fieldset className="network-fields" disabled={!editable}>
          <legend>Services</legend>
          <label className="network-check"><input type="checkbox" checked={plan.install} onChange={(event) => edit({ ...plan, install: event.target.checked })} /> Include installation per Starlink kit</label>
          <label className="network-check"><input type="checkbox" checked={plan.deployment} onChange={(event) => edit({ ...plan, deployment: event.target.checked })} /> Include advanced configuration and deployment</label>
        </fieldset>
        {quote.parts.length ? <dl className="network-quote-lines">{quote.parts.map((part) => <div key={part.key}>
          <dt>{part.quantity}{part.key === "cable" ? " m" : " ×"} {part.label}
            {part.price !== null && <small>₦{networkNaira(part.price)} / {part.key === "cable" ? "metre" : "unit"}</small>}</dt>
          <dd>{part.total === null ? "Quote required" : `₦${networkNaira(part.total)}`}</dd>
        </div>)}</dl> : <p className="muted">Add equipment to begin your quote.</p>}
        <div className="network-total"><span>{quote.pending ? "Priced subtotal" : "Budget estimate"}</span><strong>₦{networkNaira(quote.subtotal)}</strong></div>
        <p className="small muted">{quote.pending ? `${quote.pending} line items require pricing. ` : ""}Subject to a site survey. Starlink subscription and any extra equipment are separate.</p>
        <div className="row">
          <button type="button" className="button button-dark" disabled={busy !== null || !quote.parts.length} onClick={download}>
            <Download size={17} aria-hidden /> {busy === "pdf" ? "Preparing PDF…" : "Download branded PDF"}</button>
          {quote.parts.length > 0 && <a className="button button-ghost" href={`${whatsapp}?text=${encodeURIComponent(brief)}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={17} aria-hidden /> WhatsApp</a>}
        </div>
        {!reviewPlan && (accountId ? <>
          <label className="field"><span>Notes for the design team (optional)</span><textarea rows={3} maxLength={600} value={notes} disabled={busy !== null}
            onChange={(event) => { setNotes(event.target.value); submission.current = null; }} /></label>
          <button className="button button-primary" type="button" onClick={send} disabled={!ready || busy !== null || !quote.parts.length}>
            <Send size={17} aria-hidden /> {busy === "review" ? "Sending…" : "Send to the design team"}</button>
        </> : <Link className="button button-primary" href={customerUrl}><Send size={17} aria-hidden /> Sign in to send for review</Link>)}
        {ownedReceipt && !reviewPlan && <Link className="text-link" href={`/dashboard/messages/${ownedReceipt.thread}`}>Track your review <ArrowUpRight size={16} aria-hidden /></Link>}
        {status && <p className="small" role="status">{status}</p>}
      </section>
    </div>
    </>}</StudioScreen>
  </section>;
}
