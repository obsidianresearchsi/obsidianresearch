"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { Maximize2, X } from "lucide-react";

export function StudioScreen({ label, children }: { label: string; children: (expanded: boolean) => ReactNode }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState(false);

  function toggle(open: boolean) {
    const element = dialog.current;
    if (!element) return;
    if (open) {
      element.removeAttribute("open");
      element.showModal();
      element.scrollTop = 0;
    } else {
      element.close();
      element.setAttribute("open", "");
      requestAnimationFrame(() => trigger.current?.focus({ preventScroll:true }));
    }
    setExpanded(open);
  }

  return <dialog className="studio-screen" ref={dialog} open aria-labelledby={id}
    onCancel={(event) => { event.preventDefault(); toggle(false); }}>
    <div className="studio-screen-bar">
      <strong id={id}>{label}</strong>
      <button className="button button-ghost" type="button" ref={trigger} onClick={() => toggle(!expanded)}>
        {expanded ? <><X size={17} aria-hidden /> Exit full screen</> : <><Maximize2 size={17} aria-hidden /> Full screen</>}
      </button>
    </div>
    {children(expanded)}
  </dialog>;
}
