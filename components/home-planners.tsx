import Link from "next/link";
import { ArrowUpRight, BatteryCharging, Box, Lightbulb, Monitor, Router, SatelliteDish, Zap } from "lucide-react";
import { INTERIOR_PLANNER, INTERIOR_SERVICE, UNIT_FINISHES } from "@/lib/interior";
import type { Content } from "@/lib/model";
import { NETWORK_SERVICE, NETWORK_STUDIO } from "@/lib/network";
import { SOLAR_ESTIMATOR, SOLAR_SERVICE, solarAppliances } from "@/lib/solar";
import { SectionHeading } from "./ui";

const sampleAppliances = [
  { id: "tv", quantity: 1, icon: Monitor },
  { id: "led", quantity: 4, icon: Lightbulb },
  { id: "router", quantity: 1, icon: Router },
];

export function HomePlanners({ services }: { services: Content[] }) {
  const interior = services.some((service) => service.slug === INTERIOR_SERVICE);
  const solar = services.find((service) => service.slug === SOLAR_SERVICE);
  const network = services.some((service) => service.slug === NETWORK_SERVICE);
  if (!interior && !solar && !network) return null;

  const appliances = solarAppliances(solar?.details.solar_appliances);
  const sample = sampleAppliances.flatMap(({ id, quantity, icon }) => {
    const appliance = appliances.find((item) => item.id === id);
    return appliance ? [{ ...appliance, quantity, icon }] : [];
  });
  const runningWatts = sample.reduce((total, item) => total + item.watts * item.quantity, 0);

  return <section className="section-compact home-planners" aria-label="Project planning tools">
    <div className="wrap">
      <SectionHeading label="Project planning tools" title="Plan your space, power and network" />
      <div className="home-planner-grid">
        {interior && <Link href={INTERIOR_PLANNER} className="home-planner-card home-planner-interior">
          <div className="home-planner-visual">
            <img src="/media/interior-portfolio.svg" alt="" width={900} height={560} loading="lazy" />
            <span className="home-planner-chip"><Box size={15} aria-hidden /> 3D room concept</span>
            <div className="home-planner-finishes" aria-hidden="true">
              {[UNIT_FINISHES.ivory, UNIT_FINISHES.sage, UNIT_FINISHES.walnut, UNIT_FINISHES.navy].map(({ color }) =>
                <span key={color} style={{ backgroundColor: color }} />)}
            </div>
          </div>
          <div className="home-planner-content">
            <h3>Interior Design Studio</h3>
            <p>Choose a kitchen or TV wall, then see your colours, finishes and dimensions in 3D.</p>
            <span className="home-planner-link">Open the 3D studio <ArrowUpRight size={18} aria-hidden /></span>
          </div>
        </Link>}
        {solar && <Link href={SOLAR_ESTIMATOR} className="home-planner-card home-planner-solar">
          <div className="home-planner-visual home-planner-power">
            <div className="home-planner-power-heading">
              <span className="home-planner-chip"><BatteryCharging size={17} aria-hidden /> Example setup</span>
              <span className="home-planner-watts"><Zap size={19} aria-hidden /> {runningWatts.toLocaleString("en-NG")} W</span>
            </div>
            <ul className="home-planner-loads">
              {sample.map(({ id, name, quantity, watts, icon: Icon }) => <li key={id}>
                <Icon size={17} aria-hidden /><span>{quantity} × {name}</span><strong>{quantity * watts} W</strong>
              </li>)}
            </ul>
          </div>
          <div className="home-planner-content">
            <h3>Solar Backup Calculator</h3>
            <p>Pick your appliances, compare batteries, and see how long your backup could last.</p>
            <span className="home-planner-link">Open the solar calculator <ArrowUpRight size={18} aria-hidden /></span>
          </div>
        </Link>}
        {network && <Link href={NETWORK_STUDIO} className="home-planner-card home-planner-network">
          <div className="home-planner-visual">
            <img src="/media/network-studio.svg" alt="" width={640} height={360} loading="lazy" />
            <span className="home-planner-chip"><SatelliteDish size={15} aria-hidden /> 3D network concept</span>
          </div>
          <div className="home-planner-content">
            <h3>Starlink Network Studio</h3>
            <p>Place a dish, router and access points. Explore traffic paths, Wi-Fi coverage and bandwidth in 3D.</p>
            <span className="home-planner-link">Open the network studio <ArrowUpRight size={18} aria-hidden /></span>
          </div>
        </Link>}
      </div>
    </div>
  </section>;
}
