import type { Metadata } from "next";
import { BookOpen, ChartNoAxesColumn, ClipboardList, FileText, GraduationCap, LayoutDashboard, Mail, MessagesSquare, Settings, ShieldCheck, UsersRound } from "lucide-react";
import { Portal } from "@/components/portal";
import { CONTENT, FINANCE, OPERATIONS, ROLE_LABELS } from "@/lib/model";
import { requireStaff } from "@/lib/supabase";

export const metadata: Metadata = { title: "Staff console", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { role } = await requireStaff();
  const links = [{ href:"/admin",label:"Overview",icon:LayoutDashboard }];
  if (OPERATIONS.includes(role)) links.push(
    { href:"/admin/courses",label:"Courses",icon:BookOpen },
    { href:"/admin/applications",label:"Applications",icon:ClipboardList },
    { href:"/admin/students",label:"Students",icon:GraduationCap },
    { href:"/admin/inbox",label:"Customer inbox",icon:MessagesSquare },
  );
  if (FINANCE.includes(role)) links.push({ href:"/admin/finance",label:"Finance",icon:ChartNoAxesColumn });
  if (CONTENT.includes(role)) links.push(
    { href:"/admin/content",label:"Site content",icon:FileText },
    { href:"/admin/enquiries",label:"Enquiries",icon:Mail },
  );
  if (role === "super_admin") links.push({ href:"/admin/settings",label:"Payment settings",icon:Settings },{ href:"/admin/staff",label:"Staff access",icon:UsersRound });
  if (CONTENT.includes(role) || role === "finance") links.push({ href:"/admin/audit",label:"Audit history",icon:ShieldCheck });
  return <Portal label="Management console" title={ROLE_LABELS[role]} links={links}>{children}</Portal>;
}
