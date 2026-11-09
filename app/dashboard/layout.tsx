import type { Metadata } from "next";
import { headers } from "next/headers";
import { BookOpen, BriefcaseBusiness, GraduationCap, LayoutDashboard, MessagesSquare } from "lucide-react";
import { Portal } from "@/components/portal";
import { safePath } from "@/lib/forms";
import { requireStudent } from "@/lib/supabase";

export const metadata: Metadata = { title: "My Workspace", robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const path = (await headers()).get("x-obsidian-request-path");
  await requireStudent(safePath(path ?? undefined));
  return <Portal label="Obsidian Workspace" title="My Workspace" links={[
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/dashboard/services", label: "Services & requests", icon: BriefcaseBusiness },
    { href: "/dashboard/messages", label: "Messages", icon: MessagesSquare },
    { href: "/dashboard/documents", label: "Documents", icon: BookOpen },
    { href: "/training", label: "Browse training", icon: GraduationCap },
  ]}>{children}</Portal>;
}
