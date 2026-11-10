"use client";

import { useMemo, type MouseEvent } from "react";
import { deviceLabel, NETWORK_DEVICES } from "@/lib/network";
import { COVERAGE_COLOURS, COVERAGE_STEP, networkCoverage, type NetworkViewProps } from "@/lib/network-view";

const glyphs = { uplink: "S", gateway: "M", distribution: "P", ap: "W" };

export function NetworkMap({ plan, simulation, coverageDevices, selected, probe, placing, path, onSelect, onPoint, equipment }:NetworkViewProps) {
  const cells = useMemo(() => networkCoverage(plan,coverageDevices,equipment),[plan,coverageDevices,equipment]);
  const deviceById = new Map(plan.devices.map((device) => [device.id, device]));

  function point(event: MouseEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const x = Math.round(100 * (event.clientX - box.left) / box.width);
    const y = Math.round(100 * (event.clientY - box.top) / box.height);
    onPoint(Math.max(4, Math.min(96, x)), Math.max(5, Math.min(95, y)));
  }

  return <div className="network-map-frame">
    <svg viewBox="0 0 500 500" className={`network-map${placing ? " network-map-place" : ""}`} aria-label="Network site map"
      onClick={point}>
      <defs>
        <pattern id="network-grid" width="25" height="25" patternUnits="userSpaceOnUse">
          <path d="M25 0H0V25" fill="none" stroke="#a8c9ed" strokeOpacity=".2" />
        </pattern>
      </defs>
      <rect width="500" height="500" fill="#101c2c" />
      <g aria-hidden>{cells.map(({ x, y, band }) => <rect key={x + 100 * y} x={x * 5} y={y * 5}
        width={COVERAGE_STEP*5} height={COVERAGE_STEP*5} fill={COVERAGE_COLOURS[band]} opacity={band === "strong" ? .28 : .16} />)}</g>
      <rect width="500" height="500" fill="url(#network-grid)" aria-hidden />
      {simulation.links.map(({ link, warning }) => {
        const from = deviceById.get(link.from);
        const to = deviceById.get(link.to);
        if (!from || !to) return null;
        const active = simulation.routes.has(to.id);
        const highlighted = path.some((id, index) => id === from.id && path[index + 1] === to.id);
        const coordinates = { x1: from.x * 5, y1: from.y * 5, x2: to.x * 5, y2: to.y * 5 };
        return <g key={to.id} aria-hidden>
          <line {...coordinates} stroke={warning ? "#f39b83" : active ? "#75b5d5" : "#617389"} strokeWidth={highlighted ? 4 : 2.5}
            strokeDasharray={link.kind === "bridge" || warning ? "7 5" : undefined} />
          {active && <line {...coordinates} className="network-flow" stroke={highlighted ? "#ebffb9" : "#c8eaff"}
            strokeWidth={highlighted ? 3.3 : 2} strokeDasharray="2 13" />}
        </g>;
      })}
      <g transform={`translate(${probe.x * 5} ${probe.y * 5})`} pointerEvents="none" aria-hidden>
        <circle r="8" fill="#071828" stroke="#fff0b2" strokeWidth="2" />
        <path d="M0-12V12M-12 0H12" stroke="#fff0b2" strokeWidth="1.3" />
      </g>
      {plan.devices.map((device) => {
        const active = simulation.routes.has(device.id);
        const isSelected = device.id === selected;
        return <g key={device.id} className="network-map-node" role="button" tabIndex={0}
          transform={`translate(${device.x * 5} ${device.y * 5})`}
          aria-label={`${deviceLabel(device,equipment)}, ${active ? "reachable" : "offline"}`} aria-pressed={isSelected}
          onClick={(event) => { event.stopPropagation(); onSelect(device.id); }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(device.id); }
          }}>
          <circle r="24" fill="transparent" />
          <circle r="15" fill={active ? "#133c4a" : "#202a3a"} stroke={isSelected ? "#ffde70" : active ? "#8fe4db" : "#8293a7"} strokeWidth={isSelected ? 3 : 1.7} />
          <text y="5" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="750">{glyphs[NETWORK_DEVICES[device.kind].role]}</text>
          <text y={device.y > 87 ? -22 : 29} textAnchor="middle" fill="#fff" fontSize="13" className="network-map-label">#{device.id}</text>
        </g>;
      })}
    </svg>
    <NetworkLegend />
  </div>;
}

export function NetworkLegend() {
  return <div className="network-legend" aria-label="Coverage legend">
    {Object.entries(COVERAGE_COLOURS).map(([label, colour]) => <span key={label}><i style={{ background: colour }} />{label}</span>)}
    <span><i className="network-probe-dot" />Test client</span><span>– – Bridge</span>
  </div>;
}

export function SatelliteScene({ hasDish, sky }: { hasDish: boolean; sky: boolean }) {
  return <section className="network-orbit-panel" aria-labelledby="network-orbit-title">
    <svg viewBox="0 0 540 210" role="img" aria-label="Illustration of satellites orbiting Earth and a Starlink dish exchanging data">
      <defs>
        <radialGradient id="network-earth"><stop stopColor="#1a638a" /><stop offset="1" stopColor="#15314c" /></radialGradient>
      </defs>
      <path d="M6 194 Q270 18 534 194 M6 167 Q270 -13 534 167 M6 141 Q270 -45 534 141" fill="none" stroke="#6597be" strokeOpacity=".32" />
      <path d="M30 210 Q270 79 510 210Z" fill="url(#network-earth)" stroke="#69cbe4" strokeWidth="1.5" />
      {[[171, 66, "#8cebd9"], [372, 67, "#9fc4fa"]].map(([x, y, colour], index) =>
        <g className={`network-satellite network-satellite-${index}`} key={x}>
          {hasDish && sky && <g className="network-beam"><path className="network-flow" d={`M266 156 ${x} ${y}`}
            fill="none" stroke={String(colour)} strokeWidth="2" strokeDasharray="3 8" /></g>}
          <g transform={`translate(${x} ${y})`}><rect x="-7" y="-6" width="14" height="12" rx="2" fill="#edf6ff" />
            <path d="M-9 0h-17m35 0h17" stroke="#9bd8ff" strokeWidth="7" /></g>
        </g>)}
      <path d="M245 179h39m-19-1v-23m-14 0 26-12" fill="none" stroke={hasDish ? "#f6d04b" : "#9aa9bb"} strokeWidth="4" strokeLinecap="round" />
      <text x="270" y="203" fill="#f2f8ff" textAnchor="middle" fontSize="12">Your Starlink terminal</text>
    </svg>
    <div>
      <p className="network-kicker">LOW EARTH ORBIT</p>
      <h3 id="network-orbit-title">From orbit to your Wi-Fi</h3>
      <p>Your dish exchanges data with passing satellites and changes satellites as they move overhead. The local router and APs distribute that connection on site.</p>
      <p className="small">{!hasDish ? "Add a Starlink kit to see the uplink." : sky ? "Illustrated uplink active · clear sky assumed" : "Illustrated uplink blocked · sky obstruction selected"}</p>
    </div>
  </section>;
}
