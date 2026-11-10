"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Box, Camera, Check, Download, Image, Layers3, MessageCircle, Moon, RotateCcw, Send, Share2, Sun, ZoomIn, ZoomOut } from "lucide-react";
import { submitInteriorReview } from "@/app/services/interior-actions";
import {
  BACKUP, CABINETS, DEFAULT_DESIGN, INTERIOR_EQUIPMENT, INTERIOR_PLANNER, INTERNET, MIN_CABINET, MIN_TV_WALL,
  PAINTS, PALETTES, TV_SIZES, TV_WALLS, UNIT_FINISHES, WOODS, designSchema, estimateInterior, fittedTv,
  interiorBrief, tvScreenWidth, unitDimensions, type InteriorDesign, type InteriorPrices,
} from "@/lib/interior";
import { money } from "@/lib/model";
import { type InteriorView, type InteriorViewer } from "./interior-scene";
import { INTERIOR_LOOKS, QUORA_TOPICS } from "@/lib/interior-looks";
import { StudioScreen } from "./studio-screen";

const Scene = dynamic(() => import("./interior-scene"), {
  ssr: false,
  loading: () => <div className="interior-viewport interior-loading">Preparing the 3D room…</div>,
});
const key = "obsidian.interior.draft.v1";
const views = [
  { id: "room", label: "Full room" }, { id: "kitchen", label: "Kitchen" },
  { id: "lounge", label: "TV wall" }, { id: "utility", label: "Equipment" },
] as const;
const sections = [
  { id: "room", label: "Space" }, { id: "kitchen", label: "Cabinets" },
  { id: "lounge", label: "TV wall" }, { id: "finishes", label: "Paint & screeding" }, { id: "utility", label: "Internet & power" },
] as const;
type Draft = {
  design: InteriorDesign; view: InteriorView; evening: boolean;
  owner: string | null; submission: string | null; receipt: { thread: string; submission: string } | null;
};
const defaultDraft: Draft = { design: DEFAULT_DESIGN, view: "room", evening: false, owner: null, submission: null, receipt: null };
const validId = (input: unknown): input is string => typeof input === "string" && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(input);

function readDraft(): Draft {
  try {
    const saved = JSON.parse(window.localStorage.getItem(key) ?? "null");
    const design = designSchema.safeParse(saved?.design);
    if (!design.success) return defaultDraft;
    const owner = validId(saved.owner) ? saved.owner : null;
    const receipt = owner && validId(saved.receipt?.thread) && validId(saved.receipt?.submission) ? saved.receipt : null;
    return { design: design.data, view: views.find(({ id }) => id === saved.view)?.id ?? "room",
      evening: saved.evening === true, owner, submission: owner && validId(saved.submission) ? saved.submission : null, receipt };
  } catch { return defaultDraft; }
}

function Choices<T extends string>({ label, value, choices, onChange }: {
  label: string; value: T; choices: Record<T, { label: string; detail: string }>; onChange: (value: T) => void;
}) {
  const options = Object.entries(choices) as [T, { label: string; detail: string }][];
  return <fieldset className="interior-choices">
    <legend>{label}</legend>
    {options.map(([id, item]) => <label className="interior-choice" key={id}>
      <input type="radio" name={label} value={id} checked={value === id} onChange={() => onChange(id)} />
      <span><strong>{item.label}</strong><small>{item.detail}</small></span>
    </label>)}
  </fieldset>;
}

function UnitFinish({ label, value, onChange }: {
  label: string; value: InteriorDesign["cabinetFinish"]; onChange: (value: InteriorDesign["cabinetFinish"]) => void;
}) {
  const finishes = Object.keys(UNIT_FINISHES) as (keyof typeof UNIT_FINISHES)[];
  return <fieldset className="interior-palettes interior-unit-finishes"><legend>{label}</legend>
    {finishes.map((id) => <label className="interior-choice" key={id}>
      <input type="radio" name={label} checked={id === value} onChange={() => onChange(id)} />
      <span className="interior-swatch" aria-hidden="true" style={{ background: UNIT_FINISHES[id].color ?? "linear-gradient(135deg,#d7c6b3,#8d705a)" }} />
      <span><strong>{UNIT_FINISHES[id].label}</strong></span>
    </label>)}
  </fieldset>;
}

function UnitSize({ label, value, min, max, onChange, reset }: {
  label: string; value: number; min: number; max: number; onChange: (value: number) => void; reset: () => void;
}) {
  return <div className="interior-unit-size">
    <label className="field"><span>{label} <strong>{value.toFixed(1)} m</strong></span>
      <input type="range" min={min} max={max} step={0.1} value={value} disabled={max === min}
        aria-valuetext={`${value.toFixed(1)} metres`} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
    <button type="button" className="text-link small" onClick={reset}>Use suggested size</button>
  </div>;
}

export function InteriorPlanner({ prices, whatsapp, accountId }: { prices: InteriorPrices; whatsapp: string; accountId: string | null }) {
  const [draft, setDraft] = useState<Draft>(defaultDraft);
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(true);
  const [section, setSection] = useState<InteriorView | "finishes">("room");
  const [lookGroup, setLookGroup] = useState<(typeof INTERIOR_LOOKS)[number]["group"]>("Kitchen");
  const [reset, setReset] = useState(0);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  const [busy, setBusy] = useState<"render" | "send" | null>(null);
  const [feedback, setFeedback] = useState("");
  const [notes, setNotes] = useState("");
  const viewer = useRef<InteriorViewer | null>(null);
  const { design, view, evening } = draft;
  const previewDesign = useDeferredValue(design);
  const previewUpdating = previewDesign !== design;
  const estimate = estimateInterior(design, prices);
  const dimensions = unitDimensions(design);
  const fittedScreen = fittedTv(design, dimensions.wall);
  const ownedDraft = accountId !== null && draft.owner === accountId;
  const receipt = ownedDraft ? draft.receipt : null;
  const sent = receipt !== null && receipt.submission === draft.submission;
  const brief = interiorBrief(design, prices);
  const message = `Hello Obsidian Research. I’d like a review of this room concept.\n\n${brief}`;
  const account = `/account?next=${encodeURIComponent(INTERIOR_PLANNER)}`;

  useEffect(() => {
    setDraft(readDraft());
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { window.localStorage.setItem(key, JSON.stringify(draft)); setSaved(true); }
    catch { setSaved(false); }
  }, [draft, ready]);
  useEffect(() => {
    const url = image?.url;
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [image]);

  function update<K extends keyof InteriorDesign>(field: K, value: InteriorDesign[K]) {
    setDraft((current) => ({ ...current, design: { ...current.design, [field]: value }, submission: null }));
    setImage(null);
    setFeedback("");
  }

  function move(next: InteriorView) {
    setDraft((current) => ({ ...current, view: next }));
    setReset((current) => current + 1);
    setImage(null);
  }

  function changeSection(next: InteriorView | "finishes") {
    setSection(next);
    move(next === "finishes" ? "room" : next);
  }

  async function capture() {
    if (previewUpdating) throw new Error("Wait for the room to update.");
    if (!viewer.current) throw new Error("The 3D viewer is unavailable.");
    const caption = `${design.width} × ${design.depth} m   /   ${PALETTES[design.palette].label}   /   ${views.find(({ id }) => id === view)?.label}`;
    const blob = await viewer.current.capture(caption);
    setImage({ blob, url: URL.createObjectURL(blob) });
    return blob;
  }

  async function renderImage() {
    setBusy("render");
    setFeedback("");
    try { await capture(); }
    catch { setFeedback("Could not render this view. Reset the camera and try again."); }
    finally { setBusy(null); }
  }

  async function submit() {
    if (busy || sent || !accountId || !estimate.parts.length) return;
    setBusy("send");
    setFeedback("");
    const submission = (ownedDraft ? draft.submission : null) ?? crypto.randomUUID();
    setDraft((current) => ({ ...current, owner: accountId, submission, receipt }));
    try {
      const form = new FormData();
      form.set("design", JSON.stringify(design));
      form.set("submission", submission);
      form.set("notes", notes);
      let omittedImage = false;
      if (available) {
        try { form.set("render", await capture(), "obsidian-interior.jpg"); }
        catch { omittedImage = true; }
      }
      const result = await submitInteriorReview(form);
      if (!result.thread) {
        setFeedback(result.error ?? "Could not send your design. Try again.");
        return;
      }
      const thread = result.thread;
      setDraft((current) => ({ ...current, receipt: { thread, submission } }));
      setFeedback(omittedImage
        ? "Design sent without an image because the render failed. Follow the review in My Workspace."
        : "Design sent. You can follow replies and review status in My Workspace.");
    } catch { setFeedback("Could not send your design. Try again."); }
    finally { setBusy(null); }
  }

  const file = image ? new File([image.blob], "obsidian-interior.jpg", { type: "image/jpeg" }) : null;
  const canShare = file !== null && typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] });
  return <section className="interior-studio" id="interior-planner" aria-labelledby="interior-title">
    <StudioScreen label="Interior Design Studio">{(expanded) => <>
    <header className="interior-mast">
      <div><span><Layers3 size={17} aria-hidden /> OBSIDIAN INTERIOR STUDIO</span>
        <h2 id="interior-title">Make the room yours</h2>
        <p>Walk around a room concept, explore finishes and equipment, then send your design to our team for a final quote.</p>
      </div>
      <span className="interior-save"><Check size={15} aria-hidden />{!ready ? "Opening studio" : saved ? "Draft saved on this device" : "Draft could not be saved"}</span>
    </header>
    <div className="interior-workbench">
      <div className="interior-viewer" id="interior-live-preview">
        <div className="interior-view-top"><span><Box size={17} aria-hidden /> 3D concept</span><span>{design.width} × {design.depth} m</span></div>
        <Scene design={previewDesign} view={view} evening={evening} reset={reset} viewer={viewer} onAvailable={setAvailable} expanded={expanded} />
        <div className="interior-view-controls">
          <div aria-label="Camera viewpoints" className="interior-viewpoints">
            {views.map((item) => <button type="button" key={item.id} disabled={busy !== null} aria-pressed={item.id === view} onClick={() => move(item.id)}>{item.label}</button>)}
          </div>
          <div className="interior-view-icons">
            <button type="button" aria-label="Zoom in" disabled={available !== true || busy !== null} onClick={() => { viewer.current?.zoom(.8); setImage(null); }}><ZoomIn size={19} aria-hidden /></button>
            <button type="button" aria-label="Zoom out" disabled={available !== true || busy !== null} onClick={() => { viewer.current?.zoom(1.25); setImage(null); }}><ZoomOut size={19} aria-hidden /></button>
            <button type="button" aria-label={evening ? "Switch to daylight" : "Switch to evening lighting"} disabled={busy !== null}
              onClick={() => { setDraft((current) => ({ ...current, evening: !current.evening })); setImage(null); }}>
              {evening ? <Sun size={19} aria-hidden /> : <Moon size={19} aria-hidden />}
            </button>
            <button type="button" aria-label="Reset camera" disabled={busy !== null} onClick={() => move(view)}><RotateCcw size={19} aria-hidden /></button>
          </div>
        </div>
        <p className="interior-view-hint">{expanded ? "Drag to look around. Pinch or use the zoom buttons for a closer view." : "Use the camera and zoom buttons, or open full screen to drag and pinch."}</p>
      </div>
      <div className="interior-editor panel stack">
        <div className="interior-steps" aria-label="Design options">
          {sections.map((item) => <button type="button" key={item.id} disabled={busy !== null}
            aria-pressed={section === item.id} onClick={() => changeSection(item.id)}>{item.label}</button>)}
        </div>
        <fieldset className="interior-editor-fields stack" disabled={busy !== null || !ready}>
          {section === "room" && <>
            <h3>Room size & finish</h3>
            <div className="interior-dimensions">
              <label className="field"><span>Width <strong>{design.width} m</strong></span>
                <input type="range" min={4} max={9} step={0.5} value={design.width} onChange={(event) => update("width", Number(event.target.value))} /></label>
              <label className="field"><span>Depth <strong>{design.depth} m</strong></span>
                <input type="range" min={4} max={8} step={0.5} value={design.depth} onChange={(event) => update("depth", Number(event.target.value))} /></label>
            </div>
            <fieldset className="interior-palettes"><legend>Colour palette</legend>
              {(Object.keys(PALETTES) as InteriorDesign["palette"][]).map((id) => <label className="interior-choice" key={id}>
                <input type="radio" name="interior-palette" checked={design.palette === id} onChange={() => update("palette", id)} />
                <span className="interior-swatch" aria-hidden="true" style={{ background: PALETTES[id].cabinet }} />
                <span><strong>{PALETTES[id].label}</strong></span>
              </label>)}
            </fieldset>
          </>}
          {section === "kitchen" && <>
            <label className="interior-include"><input type="checkbox" checked={design.includeCabinets}
              onChange={(event) => update("includeCabinets", event.target.checked)} /> Include kitchen cabinets</label>
            {design.includeCabinets && <>
              <Choices label="Cabinet design" value={design.cabinet} choices={CABINETS} onChange={(value) => update("cabinet", value)} />
              <UnitSize label="Cabinet run" value={dimensions.cabinet} min={MIN_CABINET} max={dimensions.maxCabinet}
                onChange={(value) => update("cabinetLength", value)} reset={() => update("cabinetLength", null)} />
              <UnitFinish label="Cabinet colour" value={design.cabinetFinish} onChange={(value) => update("cabinetFinish", value)} />
              <Choices label="Cabinet material" value={design.wood} choices={WOODS} onChange={(value) => update("wood", value)} />
              <fieldset className="interior-choices"><legend>Kitchen equipment</legend>
                {(["sink", "hob"] as const).map((item) => <label key={item} className="interior-choice">
                  <input type="checkbox" checked={design[item]} onChange={(event) => update(item, event.target.checked)} />
                  <span><strong>{INTERIOR_EQUIPMENT[item].label}</strong><small>{money(prices[item])}</small></span>
                </label>)}
              </fieldset>
            </>}
          </>}
          {section === "lounge" && <>
            <label className="interior-include"><input type="checkbox" checked={design.includeWall}
              onChange={(event) => update("includeWall", event.target.checked)} /> Include a TV feature wall</label>
            {design.includeWall && <>
              <Choices label="TV wall design" value={design.wall} choices={TV_WALLS} onChange={(value) => update("wall", value)} />
              <UnitSize label="TV wall width" value={dimensions.wall} min={MIN_TV_WALL} max={dimensions.maxWall}
                onChange={(value) => update("tvWallWidth", value)} reset={() => update("tvWallWidth", null)} />
              <UnitFinish label="TV wall colour" value={design.tvFinish} onChange={(value) => update("tvFinish", value)} />
              <fieldset className="interior-choices"><legend>Media equipment</legend>
                <label className="field"><span>Screen size</span><select value={fittedScreen}
                  onChange={(event) => update("tvSize", event.target.value as InteriorDesign["tvSize"])}>
                  <option value="none">No screen</option>
                  {TV_SIZES.map((size) => <option key={size} value={size} disabled={tvScreenWidth(size) + 0.12 > dimensions.wall}>{size} inches</option>)}
                </select></label>
                {fittedScreen !== design.tvSize && <p className="small muted">The preview uses a {fittedScreen}-inch screen at this wall width. Widen the wall to fit your chosen screen.</p>}
                {fittedScreen !== "none" && <label className="interior-choice">
                  <input type="checkbox" checked={design.supplyTv} onChange={(event) => update("supplyTv", event.target.checked)} />
                  <span><strong>Include TV in estimate</strong><small>{money(prices[`tv_${fittedScreen}`])} · Leave off to preview your own TV</small></span>
                </label>}
                <label className="interior-choice">
                  <input type="checkbox" checked={design.console} onChange={(event) => update("console", event.target.checked)} />
                  <span><strong>{INTERIOR_EQUIPMENT.console.label}</strong><small>{money(prices.console)}</small></span>
                </label>
              </fieldset>
            </>}
          </>}
          {section === "finishes" && <>
            <h3>Finish the walls</h3>
            <p className="small muted">Pick each wall’s colour separately. Add screeding to include the cost of levelling the wall before painting.</p>
            {(["paint", "accentPaint"] as const).map((field) => <label className="field" key={field}>
              <span>{field === "paint" ? "Main wall paint" : "Window wall paint"}</span>
              <select value={design[field]} onChange={(event) => {
                const value = event.target.value as InteriorDesign[typeof field];
                update(field, value);
              }}>
                <option value="palette">Use room palette</option>
                {Object.entries(PAINTS).map(([id, paint]) => <option key={id} value={id}>{paint.label}</option>)}
              </select>
            </label>)}
            <Choices label="Wall screeding" value={design.screed} choices={{
              none: { label: "No screeding", detail: "Wall is ready for paint" },
              main: { label: "Main wall only", detail: "Prepare the kitchen and TV wall" },
              both: { label: "Both walls", detail: "Prepare the main and window walls" },
            }} onChange={(value) => update("screed", value)} />
          </>}
          {section === "utility" && <>
            <Choices label="Internet kit" value={design.internet} choices={INTERNET} onChange={(value) => update("internet", value)} />
            <Choices label="Inverter setup" value={design.backup} choices={BACKUP} onChange={(value) => update("backup", value)} />
            <p className="small muted">The equipment view shows concept placements. Our team confirms dish siting and backup sizing during review.</p>
          </>}
        </fieldset>
        <a className="text-link interior-preview-jump" href="#interior-live-preview">See your changes in 3D <ArrowUpRight size={15} aria-hidden /></a>
      </div>
    </div>
    <section className="panel stack interior-looks">
      <div><h3>Explore 18 studio looks</h3><p className="small muted">Apply a concept, then change any finish to make it yours.</p></div>
      <div className="interior-steps" aria-label="Look categories">
        {(["Kitchen", "TV wall", "Paint"] as const).map((name) => <button key={name} type="button" aria-pressed={lookGroup === name} onClick={() => setLookGroup(name)}>{name} looks</button>)}
      </div>
      <div className="interior-look-grid">{INTERIOR_LOOKS.filter(({ group }) => group === lookGroup).map((look) => {
        const palette = PALETTES[look.design.palette ?? "amber"];
        const paint = look.design.paint ? PAINTS[look.design.paint].color : palette.wall;
        return <button key={look.title} type="button" disabled={!ready || busy !== null} onClick={() => {
          setDraft((current) => ({
            ...current,
            design: { ...current.design, ...look.design, ...(look.group === "Kitchen" ? { includeCabinets: true, wood: look.design.wood ?? "standard" } : {}),
              ...(look.group === "TV wall" ? { includeWall: true } : {}) },
            submission: null,
          }));
          setImage(null);
          setFeedback("");
          changeSection(look.group === "Kitchen" ? "kitchen" : look.group === "TV wall" ? "lounge" : "finishes");
          document.getElementById("interior-live-preview")?.scrollIntoView({ block: "start" });
        }}><span className="interior-look-swatch" style={{ background: `linear-gradient(128deg, ${paint} 0 49%, ${palette.cabinet} 50% 76%, ${palette.wood} 77%)` }} />
          <strong>{look.title}</strong><small>Apply to room <ArrowUpRight size={12} aria-hidden /></small></button>;
      })}</div>
      <details className="solar-assumptions"><summary>Browse related ideas on Quora</summary>
        <div className="row">{QUORA_TOPICS.map((topic) => <a className="text-link" key={topic}
          href={`https://www.quora.com/search?q=${encodeURIComponent(topic)}`} target="_blank" rel="noopener noreferrer">{topic} <ArrowUpRight size={14} aria-hidden /></a>)}</div>
      </details>
    </section>
    <div className="interior-results">
      <section className="panel stack interior-quote"><h3>Budget estimate</h3>
        {estimate.parts.length ? <>
          <dl>{estimate.parts.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{money(item.price)}</dd></div>)}</dl>
          <div className="interior-total"><span>Estimated total</span><strong>{money(estimate.total)}</strong></div>
          <p className="small muted">The estimate covers selected items at the current planning rates. Site measurements, installation and equipment availability are confirmed with your final quote.</p>
        </> : <p className="muted">Add a cabinet, TV wall, internet kit or backup system to start your estimate.</p>}
      </section>
      <section className="panel stack interior-sharing"><h3>Render & send</h3>
        {image && <img className="interior-render" src={image.url} alt="Your rendered interior design concept" />}
        <div className="row">
          <button type="button" className="button button-ghost" onClick={renderImage} disabled={!available || busy !== null || previewUpdating}>
            <Camera size={17} aria-hidden /> {busy === "render" ? "Rendering…" : image ? "Render this view again" : "Render room image"}
          </button>
          {image && <a className="button button-ghost" href={image.url} download="obsidian-interior.jpg"><Download size={17} aria-hidden /> Download JPG</a>}
          {canShare && file && <button className="button button-ghost" type="button" onClick={() =>
            navigator.share({ files: [file], title: "Obsidian interior concept", text: brief }).catch((error: Error) => {
              if (error.name !== "AbortError") setFeedback("Use Download JPG to save and share this image.");
            })}><Share2 size={17} aria-hidden /> Share image</button>}
        </div>
        {estimate.parts.length > 0 && <a className="button interior-whatsapp" href={`${whatsapp}?text=${encodeURIComponent(message)}`}
          target="_blank" rel="noopener noreferrer"><MessageCircle size={18} aria-hidden /> Review on WhatsApp <ArrowUpRight size={16} aria-hidden /></a>}
        <p className="small muted">WhatsApp opens your estimate as a draft. Download the JPG to attach it to that chat, or use Share image on supported devices.</p>
        {accountId ? <>
          {!sent && <label className="field"><span>Notes for our team (optional)</span>
            <textarea rows={3} maxLength={700} value={notes} disabled={busy !== null} onChange={(event) => {
              setNotes(event.target.value);
              setDraft((current) => ({ ...current, submission: null }));
            }}
              placeholder="Tell us where the project is and what you’d like us to check." />
          </label>}
          {!sent && <button type="button" className="button button-primary" disabled={!ready || busy !== null || available === null || previewUpdating || !estimate.parts.length}
            onClick={submit}><Send size={17} aria-hidden /> {busy === "send" ? "Sending…" : "Send to our design team"}</button>}
        </> : <Link className="button button-primary" href={account}><Send size={17} aria-hidden /> Sign in to send to our team</Link>}
        {receipt && <Link className="text-link" href={`/dashboard/messages/${receipt.thread}`}>
          <Image size={17} aria-hidden /> Track your latest review <ArrowUpRight size={16} aria-hidden />
        </Link>}
        {feedback && <p className="small" role="status">{feedback}</p>}
      </section>
    </div>
    </>}</StudioScreen>
  </section>;
}
