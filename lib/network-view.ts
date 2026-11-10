import { coverageBand, signalAt, type NetworkPlan, type simulateNetwork } from "./network";
import type { StudioEquipment } from "./studio-equipment";

export const COVERAGE_COLOURS = { strong:"#62e6a4", usable:"#5dacf1", weak:"#d6ad62" } as const;
export const COVERAGE_STEP = 5;

export type NetworkViewProps = {
  plan:NetworkPlan;
  simulation:ReturnType<typeof simulateNetwork>;
  coverageDevices:Set<number>;
  equipment:StudioEquipment[];
  selected:number|null;
  probe:{ x:number;y:number };
  placing:boolean;
  path:number[];
  onSelect:(id:number)=>void;
  onPoint:(x:number,y:number)=>void;
};

export function networkCoverage(plan:NetworkPlan, devices:Set<number>, equipment:StudioEquipment[]) {
  const steps = 100 / COVERAGE_STEP;
  const cells: { x:number;y:number;band:keyof typeof COVERAGE_COLOURS }[] = [];
  for (let row=0;row<steps;row++) for (let column=0;column<steps;column++) {
    const x=column*COVERAGE_STEP;
    const y=row*COVERAGE_STEP;
    const sample=signalAt(plan,x+COVERAGE_STEP/2,y+COVERAGE_STEP/2,devices,equipment);
    const band=sample && coverageBand(sample.dbm);
    if (band) cells.push({x,y,band});
  }
  return cells;
}
