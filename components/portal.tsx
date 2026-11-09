import { LogOut, type LucideIcon } from "lucide-react";
import { signOut } from "@/app/actions";
import type { ReactNode } from "react";
import { PortalLink } from "./portal-link";

export function Portal({ label, title, links, children }: {
  label: string; title: string; links: { href: string; label: string; icon: LucideIcon }[]; children: ReactNode;
}) {
  return <section className="portal"><div className="wrap portal-layout">
    <aside className="sidebar no-print">
      <div className="sidebar-title"><small>{label}</small><strong>{title}</strong></div>
      <nav aria-label={label}>{links.map(({ href, label, icon: Icon }) => <PortalLink href={href} key={href}><Icon size={16} aria-hidden />{label}</PortalLink>)}</nav>
      <form action={signOut}><button type="submit"><LogOut size={16} aria-hidden />Sign out</button></form>
    </aside>
    <div className="stack min-w-0">{children}</div>
  </div></section>;
}

export function PortalTitle({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return <header className="portal-title"><div><h1>{title}</h1>{children && <p>{children}</p>}</div>{action}</header>;
}

export function Metrics({ items }: { items: [string, ReactNode][] }) {
  return <div className="metrics">{items.map(([label, value]) => <div className="metric" key={label}>
    <small>{label}</small><strong>{value}</strong></div>)}</div>;
}
