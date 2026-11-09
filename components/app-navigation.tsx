"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, BriefcaseBusiness, GraduationCap, House, Menu, Newspaper, UserRound, X } from "lucide-react";

const tabs = [
  { label: "Home", href: "/", Icon: House },
  { label: "Services", href: "/services", Icon: BriefcaseBusiness },
  { label: "Training", href: "/training", Icon: GraduationCap },
  { label: "News", href: "/news", Icon: Newspaper },
  { label: "Workspace", href: "/dashboard", Icon: UserRound },
];

function isCurrent(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(href + "/")) ||
    (href === "/dashboard" && pathname.startsWith("/account")) ||
    (href === "/training" && pathname.startsWith("/apply/"));
}

export function HeaderNavigation({ links }: { links: { label: string; href: string }[] }) {
  const pathname = usePathname();
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const open = menuPath === pathname;
  const button = useRef<HTMLButtonElement>(null);
  const close = () => setMenuPath(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuPath(null);
        button.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  return <>
    <nav className="desktop-nav" aria-label="Main navigation">{links.map(({ label, href }) =>
      <Link key={href} href={href} aria-current={isCurrent(pathname, href) ? "page" : undefined}>{label}</Link>)}</nav>
    <Link href="/dashboard" className="nav-portal" aria-current={isCurrent(pathname, "/dashboard") ? "page" : undefined}>
      My Workspace <ArrowUpRight size={15} aria-hidden />
    </Link>
    <div className="mobile-nav" data-open={open}>
      <button ref={button} className="mobile-menu-button" type="button" aria-label={open ? "Close menu" : "Open menu"}
        aria-controls="site-mobile-menu" aria-expanded={open} onClick={() => open ? close() : setMenuPath(pathname)}>
        <Menu className="mobile-menu-open-icon" size={22} aria-hidden /><X className="mobile-menu-close-icon" size={22} aria-hidden />
      </button>
      <div className="mobile-menu-shade" aria-hidden="true" onClick={close} />
      <nav className="mobile-menu-panel" id="site-mobile-menu" inert={!open} aria-label="Mobile menu">
        {[...links, { label: "My Workspace", href: "/dashboard" }].map(({ label, href }) =>
          <Link key={href} href={href} aria-current={isCurrent(pathname, href) ? "page" : undefined} onClick={close}>
            {label} <ArrowUpRight size={15} aria-hidden />
          </Link>)}
      </nav>
    </div>
  </>;
}

export function MobileTabs() {
  const pathname = usePathname();
  return <nav className="mobile-tabs no-print" aria-label="Quick navigation">
    {tabs.map(({ label, href, Icon }) => <Link key={href} href={href}
      aria-current={isCurrent(pathname, href) ? "page" : undefined}>
      <span className="mobile-tab-icon"><Icon size={21} aria-hidden /></span><span>{label}</span>
    </Link>)}
  </nav>;
}
