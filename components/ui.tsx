import Link from "next/link";
import { ArrowRight, ArrowUpRight, ChevronRight } from "lucide-react";
import { useId, type ComponentProps, type ReactNode } from "react";

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow"><span aria-hidden="true" />{children}</p>;
}

export function ButtonLink({ href, children, variant = "primary", arrow = "right" }: {
  href: string; children: ReactNode; variant?: "primary" | "ghost" | "dark"; arrow?: "right" | "up" | "none";
}) {
  return <Link className={`button button-${variant}`} href={href}>{children}
    {arrow === "right" ? <ArrowRight size={17} aria-hidden /> : arrow === "up" ? <ArrowUpRight size={17} aria-hidden /> : null}
  </Link>;
}

export function Intro({ label, title, children }: { label: string; title: string; children?: ReactNode }) {
  return <header className="page-intro"><div className="wrap">
    <Eyebrow>{label}</Eyebrow><h1>{title}</h1>{children && <div className="intro-copy">{children}</div>}
  </div></header>;
}

export function SectionHeading({ label, title, children }: { label: string; title: string; children?: ReactNode }) {
  return <div className="section-heading"><div><Eyebrow>{label}</Eyebrow><h2>{title}</h2></div>{children}</div>;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "green" | "gold" | "blue" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="empty"><h3>{title}</h3>{children && <div>{children}</div>}</div>;
}

export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "error" | "success" }) {
  return <div role={tone === "error" ? "alert" : "status"} className={`notice notice-${tone}`}>{children}</div>;
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return <nav className="breadcrumbs" aria-label="Breadcrumb">{items.map(({ label, href }, i) =>
    <span key={`${label}-${i}`}>{i > 0 && <ChevronRight size={13} aria-hidden />}
      {href ? <Link href={href}>{label}</Link> : <span aria-current="page">{label}</span>}</span>
  )}</nav>;
}

export function Field({ label, hint, ...props }: ComponentProps<"input"> & { label: string; hint?: string }) {
  const generatedId = useId();
  const id = props.id ?? generatedId;
  return <label className="field" htmlFor={id}><span>{label}{props.required && <span className="required" aria-hidden> *</span>}</span>
    <input {...props} id={id} aria-describedby={hint ? `${id}-hint` : undefined} />
    {hint && <small id={`${id}-hint`}>{hint}</small>}
  </label>;
}

export function Textarea({ label, hint, ...props }: ComponentProps<"textarea"> & { label: string; hint?: string }) {
  const generatedId = useId();
  const id = props.id ?? generatedId;
  return <label className="field" htmlFor={id}><span>{label}{props.required && <span className="required" aria-hidden> *</span>}</span>
    <textarea {...props} id={id} aria-describedby={hint ? `${id}-hint` : undefined} />
    {hint && <small id={`${id}-hint`}>{hint}</small>}
  </label>;
}

export function Select({ label, children, ...props }: ComponentProps<"select"> & { label: string }) {
  return <label className="field"><span>{label}</span><select {...props}>{children}</select></label>;
}

export function Check({ children, ...props }: ComponentProps<"input"> & { children: ReactNode }) {
  return <label className="check"><input {...props} type="checkbox" /><span>{children}</span></label>;
}

export function DataList({ items }: { items: [string, ReactNode][] }) {
  return <dl className="data-list">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}
