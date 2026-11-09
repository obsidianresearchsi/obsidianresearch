"use client";

import { useState, useTransition } from "react";
import { Ticket } from "lucide-react";
import { checkRegistrationCoupon } from "@/app/actions";
import { money } from "@/lib/model";

export function CouponEntry({ course }: { course: string }) {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<Awaited<ReturnType<typeof checkRegistrationCoupon>> | null>(null);
  const [pending, start] = useTransition();
  return <fieldset className="fieldset coupon-entry">
    <legend><Ticket size={16} aria-hidden /> Registration coupon</legend>
    <label className="field"><span>Coupon code <small>(optional)</small></span>
      <span className="coupon-input"><input name="coupon_code" autoComplete="off" placeholder="Enter your code"
        maxLength={32} value={code} readOnly={pending} onChange={(event) => { setCode(event.target.value.toUpperCase()); setResult(null); }} />
        <button className="button button-ghost" type="button" disabled={pending || !code.trim()} onClick={() => start(async () => {
          try { setResult(await checkRegistrationCoupon(course, code)); }
          catch { setResult({ error: "Could not check the coupon. Try again." }); }
        })}>{pending ? "Checking…" : "Apply code"}</button></span>
    </label>
    {result?.error && <p className="notice notice-error" role="alert">{result.error}</p>}
    {result?.payable !== undefined && <p className="notice notice-success" role="status">
      You save {money(result.discount ?? 0)}. Estimated registration fee: <strong>{money(result.payable)}</strong>.
    </p>}
    <p className="small muted">A coupon replaces the automatic offer. Your code and fee are confirmed when you submit.</p>
  </fieldset>;
}
