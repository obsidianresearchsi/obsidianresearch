"use client";

import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { shareBandwidth } from "@/lib/bandwidth";

const format = new Intl.NumberFormat("en-NG", { maximumFractionDigits:2 });
const show = (value: number) => format.format(value);

function BandwidthInput({ label,min,max,value,set }: { label:string;min:number;max:number;value:number;set:(value:number)=>void }) {
  const [draft,setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); },[value]);
  return <label className="field"><span>{label}</span><input type="number" min={min} max={max} step={1} inputMode="numeric" value={draft}
    onChange={(event) => {
      const next=event.target.value;
      const number=Number(next);
      setDraft(next);
      if (next && Number.isInteger(number) && number>=min && number<=max) set(number);
    }} onBlur={() => {
      const number = draft && Number.isFinite(Number(draft)) ? Math.round(Number(draft)) : value;
      const next = Math.min(max,Math.max(min,number));
      set(next); setDraft(String(next));
    }} /></label>;
}

export function BandwidthPlanner({ online }: { online: boolean }) {
  const [capacity,setCapacity] = useState(340);
  const [reserve,setReserve] = useState(0);
  const [basic,setBasic] = useState(50);
  const [fast,setFast] = useState(0);
  const [basicCap,setBasicCap] = useState(5);
  const [fastCap,setFastCap] = useState(10);
  const allocation = shareBandwidth(capacity,reserve,basic,fast,basicCap,fastCap);
  const inputs = [
    { label:"Download capacity (Mbps)", min:10,max:2000,value:capacity,set:setCapacity },
    { label:"Reserved headroom (%)", min:0,max:40,value:reserve,set:setReserve },
    { label:"Basic users online", min:0,max:500,value:basic,set:setBasic },
    { label:"Basic cap (Mbps per user)", min:1,max:100,value:basicCap,set:setBasicCap },
    { label:"Fast users online", min:0,max:500,value:fast,set:setFast },
    { label:"Fast cap (Mbps per user)", min:1,max:100,value:fastCap,set:setFastCap },
  ];
  return <section className="panel stack network-bandwidth" aria-labelledby="bandwidth-title">
    <div><p className="eyebrow"><span aria-hidden /> MikroTik bandwidth planning</p>
      <h3 id="bandwidth-title" className="row"><Activity size={20} aria-hidden /> Share one Starlink connection</h3>
      <p className="small muted">Adjust measured download capacity and the number of people using it at the same time.</p>
    </div>
    {!online && <p className="small network-warning">The current topology has no reachable MikroTik gateway. The example below still shows how the queue would share bandwidth.</p>}
    <div className="row">
      {[340,400].map((speed) => <button type="button" className="button button-ghost" key={speed} aria-pressed={capacity===speed} onClick={() => setCapacity(speed)}>{speed} Mbps</button>)}
      <button type="button" className="button button-ghost" onClick={() => { setBasic(50);setBasicCap(5);setFast(0); }}>50 × 5 Mbps</button>
      <button type="button" className="button button-ghost" onClick={() => { setBasic(0);setFast(50);setFastCap(10); }}>50 × 10 Mbps</button>
    </div>
    <div className="network-bandwidth-inputs">{inputs.map((input) => <BandwidthInput key={input.label} {...input} />)}</div>
    <div className="network-bandwidth-results" aria-live="polite">
      <div><small>Usable pool</small><strong>{show(allocation.usable)} Mbps</strong></div>
      <div><small>Demand at user caps</small><strong>{show(allocation.demand)} Mbps</strong></div>
      <div><small>Basic · actual per user</small><strong>{basic ? `${show(allocation.rates.basic)} Mbps` : "—"}</strong></div>
      <div><small>Fast · actual per user</small><strong>{fast ? `${show(allocation.rates.fast)} Mbps` : "—"}</strong></div>
    </div>
    <div className="network-pool" aria-hidden="true">
      <i style={{width:`${basic * allocation.rates.basic / allocation.usable * 100}%`}} />
      <i style={{width:`${fast * allocation.rates.fast / allocation.usable * 100}%`}} />
    </div>
    <div className="network-pool-key small"><span>Basic: {show(basic*allocation.rates.basic)} Mbps</span><span>Fast: {show(fast*allocation.rates.fast)} Mbps</span><span>Spare: {show(allocation.available)} Mbps</span></div>
    <p className="small muted">{allocation.demand > allocation.usable
      ? "Demand exceeds the pool. Active users share what is available, while lower caps leave the remainder for the other group."
      : `${show(allocation.available)} Mbps remains after serving every active user at their cap.`}</p>
    <details className="solar-assumptions"><summary>Queue and multi-uplink assumptions</summary>
      <p>This is a fair-sharing model for one download pool with per-client caps. Starlink speeds vary by plan, place and time. Use a measured peak-hour speed for planning.</p>
      <p>A second WAN needs a separate routing design. Connection-based balancing spreads separate connections over uplinks. This scenario leaves hotspot traffic on the default route.</p>
    </details>
  </section>;
}
