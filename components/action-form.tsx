"use client";

import { startTransition, useActionState, useEffect, useRef, type ReactNode } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import type { FormState } from "@/lib/forms";
import { useRegistrationClock } from "./registration-clock";

export function ActionForm({ action, children, submit, className, tone = "primary", confirm, clearAfterSend, closesAt }: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  children?: ReactNode; submit: string; className?: string; tone?: "primary" | "dark" | "ghost"; confirm?: string; clearAfterSend?: boolean; closesAt?: string | null;
}) {
  const [state, dispatch, pending] = useActionState(action, {});
  const form = useRef<HTMLFormElement>(null);
  const { expired } = useRegistrationClock(closesAt);
  useEffect(() => {
    if (clearAfterSend && state.success) form.current?.reset();
  }, [state, clearAfterSend]);
  return <form ref={form} action={dispatch} className={`action-form ${className ?? ""}`} onSubmit={(event) => {
    event.preventDefault();
    if (pending || expired || (closesAt && Date.parse(closesAt) <= Date.now()) || (confirm && !window.confirm(confirm))) return;
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  }}>
    {children}
    {state.error && <div role="alert" className="notice notice-error">{state.error}</div>}
    {state.success && <div role="status" className="notice notice-success">{state.success}</div>}
    <button className={`button button-${tone}`} type="submit" disabled={pending || expired}>
      {pending ? "Working…" : expired ? "Registration closed" : submit}{pending ? <LoaderCircle size={17} className="spin" aria-hidden /> : <ArrowRight size={17} aria-hidden />}
    </button>
  </form>;
}
