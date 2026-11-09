"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function PortalLink({ href, children }: { href:string; children:ReactNode }) {
  const pathname = usePathname();
  const overview = href === "/dashboard" || href === "/admin";
  const active = pathname === href || (!overview && pathname.startsWith(href + "/")) ||
    (href === "/dashboard" && pathname.startsWith("/dashboard/applications/"));
  return <Link href={href} aria-current={active ? "page" : undefined}>{children}</Link>;
}
