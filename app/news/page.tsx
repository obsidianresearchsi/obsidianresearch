import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { Empty, Notice } from "@/components/ui";
import { detail } from "@/lib/catalog";
import { articleDate, editorialImage, readingMinutes } from "@/lib/editorial";
import { calendar, type Content } from "@/lib/model";
import { publicDb } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title:"News & insights", description:"Updates, stories, and practical ideas from Obsidian Research." };

export default async function News({ searchParams }: { searchParams:Promise<{page?:string}> }) {
  const { page:rawPage } = await searchParams;
  const page = Math.max(1,Math.min(1000,Number.parseInt(rawPage ?? "",10) || 1));
  const db = publicDb();
  const result = await db?.from("site_content").select("*",{ count:"exact" }).eq("kind","article").eq("published",true)
    .order("details->>published_at",{ascending:false,nullsFirst:false}).order("updated_at",{ascending:false}).order("id").range((page-1)*12,page*12-1);
  const articles = (result?.data ?? []) as Content[];
  return <section className="journal wrap">
    <header className="journal-masthead">
      <p className="journal-kicker"><BookOpen size={16} aria-hidden /> THE OBSIDIAN JOURNAL</p>
      <h1>News & insights</h1>
      <p>Updates from our team, stories from the academy, and practical ideas from the work we do.</p>
    </header>
    {!db || result?.error ? <Notice tone="error">The journal could not be loaded. Try again shortly.</Notice> :
      !articles.length ? <Empty title="No articles on this page">Check back for new stories and updates from Obsidian Research.</Empty> :
        <div className="journal-list">{articles.map((item) => {
          const cover = editorialImage(item.details.cover_url);
          return <article className="journal-teaser" key={item.id}>
            <div>
              <p className="journal-byline">{detail(item,"author","Obsidian Research")} <span>·</span> {calendar(articleDate(item))} <span>·</span> {readingMinutes(item.body)} min read</p>
              <h2><Link href={`/news/${item.slug}`}>{item.title}</Link></h2>
              <p>{item.summary}</p>
              <Link className="text-link" href={`/news/${item.slug}`}>Read article <ArrowUpRight size={16} aria-hidden /></Link>
            </div>
            {cover && <img src={cover} alt={detail(item,"cover_alt")} loading="lazy" />}
          </article>;
        })}</div>}
    <nav className="row journal-pager" aria-label="Journal pages">
      {page>1 && <Link className="text-link" href={`/news?page=${page-1}`}>Previous page</Link>}
      {(result?.count ?? 0)>page*12 && <Link className="text-link" href={`/news?page=${page+1}`}>Next page</Link>}
    </nav>
  </section>;
}
