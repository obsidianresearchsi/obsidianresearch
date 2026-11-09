import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { detail } from "@/lib/catalog";
import { articleDate, editorialImage, readingMinutes } from "@/lib/editorial";
import { calendar, type Content } from "@/lib/model";
import { publicDb } from "@/lib/supabase";

export const dynamic = "force-dynamic";
const articleFor = cache(async (slug: string) => {
  const result = await publicDb()?.from("site_content").select("*").eq("kind","article").eq("slug",slug).eq("published",true).maybeSingle<Content>();
  return result?.data;
});

export async function generateMetadata({params}: {params:Promise<{slug:string}>}): Promise<Metadata> {
  const item = await articleFor((await params).slug);
  if (!item) return { title:"Article unavailable" };
  const cover = editorialImage(item.details.cover_url);
  return { title:item.title, description:item.summary, openGraph:{type:"article",title:item.title,description:item.summary,
    publishedTime:articleDate(item),authors:[detail(item,"author","Obsidian Research")],images:cover ? [cover] : undefined} };
}

function ArticleBody({ body }: { body: string }) {
  return <div className="article-body">{body.trim().split(/\r?\n[ \t]*\r?\n/).map((block,index) => {
    const paragraph = block.trim();
    const picture = /^!\[([^\]]*)\]\(([^\s)]+)\)$/.exec(paragraph);
    if (picture) {
      const src = editorialImage(picture[2]);
      return src ? <figure key={index}><img src={src} alt={picture[1]} loading="lazy" /></figure> : null;
    }
    if (/^###\s/.test(paragraph)) return <h3 key={index}>{paragraph.slice(4)}</h3>;
    if (/^##\s/.test(paragraph)) return <h2 key={index}>{paragraph.slice(3)}</h2>;
    if (/^>\s/.test(paragraph)) return <blockquote key={index}>{paragraph.replace(/^>\s?/gm,"")}</blockquote>;
    const lines = paragraph.split(/\r?\n/);
    if (lines.every((line) => /^-\s/.test(line))) return <ul key={index}>{lines.map((line,i) => <li key={i}>{line.slice(2)}</li>)}</ul>;
    return <p key={index}>{paragraph}</p>;
  })}</div>;
}

export default async function Article({params}: {params:Promise<{slug:string}>}) {
  const item = await articleFor((await params).slug);
  if (!item) notFound();
  const cover = editorialImage(item.details.cover_url);
  return <article className="journal-article wrap">
    <header className="article-header">
      <Link className="text-link" href="/news"><ArrowLeft size={16} aria-hidden /> Back to the journal</Link>
      <h1>{item.title}</h1>
      <p className="article-lead">{item.summary}</p>
      <p className="journal-byline"><strong>{detail(item,"author","Obsidian Research")}</strong> <span>·</span> {calendar(articleDate(item))} <span>·</span> {readingMinutes(item.body)} min read</p>
    </header>
    {cover && <figure className="article-cover"><img src={cover} alt={detail(item,"cover_alt")} /></figure>}
    <ArticleBody body={item.body} />
  </article>;
}
