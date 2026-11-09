import { ArrowUpRight, FileText } from "lucide-react";
import { PortalTitle } from "@/components/portal";
import { ButtonLink } from "@/components/ui";

const documents = [
  ["rules", "Student Rules & Regulations"],
  ["agreement", "Registration & Training Agreement"],
  ["guidelines", "Brand Identity & Creative Guidelines"],
];

export default function Documents() {
  return <><PortalTitle title="Document library">Read or save the documents for your records.</PortalTitle>
    <section className="panel"><h2>Guidelines and rules</h2>
      <div className="document-list">{documents.map(([slug, name]) => <a key={slug} href={`/api/documents/${slug}`} target="_blank" rel="noopener">
        <span className="row"><FileText size={19} aria-hidden />{name}</span><ArrowUpRight size={18} aria-hidden />
      </a>)}</div>
      <div className="mt-4"><ButtonLink href="/policies" variant="ghost">Read online policies</ButtonLink></div>
    </section></>;
}
