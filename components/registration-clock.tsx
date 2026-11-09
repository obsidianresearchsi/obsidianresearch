"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Clock3, UsersRound } from "lucide-react";
import { Badge } from "./ui";

export function useRegistrationClock(deadline: string | null | undefined, initialTime = 0, tick = false) {
  const [now, setNow] = useState(initialTime);
  const ends = deadline ? Date.parse(deadline) : null;
  useEffect(() => {
    if (ends === null || !Number.isFinite(ends)) return;
    let timer: number;
    function update() {
      const current = Date.now();
      setNow(current);
      const remaining = (ends as number) - current;
      if (remaining > 0) timer = window.setTimeout(update, Math.min(remaining, tick ? 1000 : 2_147_000_000));
    }
    update();
    return () => window.clearTimeout(timer);
  }, [ends, tick]);
  return { expired: ends !== null && now >= ends, seconds: ends === null ? null : Math.max(0, Math.ceil((ends - now) / 1000)) };
}

type Availability = { deadline: string | null; open: boolean; label: string };

export function RegistrationBadge({ deadline, open, label }: Availability) {
  const { expired } = useRegistrationClock(open ? deadline : null);
  return <Badge tone={open && !expired ? "green" : "neutral"}>{open && expired ? "Registration closed" : label}</Badge>;
}

export function RegistrationGate({ deadline, children, closed }: { deadline: string | null; children: ReactNode; closed?: ReactNode }) {
  const { expired } = useRegistrationClock(deadline);
  return expired ? closed ?? null : children;
}

export function RegistrationCountdown({ deadline, spots, open, initialTime }: Omit<Availability,"label"> & { spots: number | null; initialTime: number }) {
  const { seconds, expired } = useRegistrationClock(open ? deadline : null, initialTime, true);
  if (!open || (deadline === null && spots === null)) return null;
  const date = deadline && new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos",
  }).format(new Date(deadline));
  const units = seconds === null ? [] : [
    [Math.floor(seconds / 86400), "days"], [Math.floor(seconds / 3600) % 24, "hours"],
    [Math.floor(seconds / 60) % 60, "min"], [seconds % 60, "sec"],
  ] as const;
  return <div className="registration-countdown">
    {expired ? <strong role="status">Registration has closed</strong> : <>
      {date && <>
        <div className="countdown-heading"><Clock3 size={17} aria-hidden /> <strong>Registration closes in</strong></div>
        <div className="countdown-digits" aria-hidden="true">{units.map(([value, unit]) =>
          <span key={unit}><b>{String(value).padStart(2, "0")}</b><small>{unit}</small></span>)}</div>
        <time dateTime={deadline ?? undefined}>{date} WAT</time>
      </>}
      {spots !== null && <div className="countdown-heading"><UsersRound size={16} aria-hidden />
        <span>{spots} {spots === 1 ? "place" : "places"} available</span>
      </div>}
    </>}
  </div>;
}
