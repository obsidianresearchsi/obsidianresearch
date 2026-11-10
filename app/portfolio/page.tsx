import type { Metadata } from "next";
import { connection } from "next/server";
import { PortfolioGallery } from "@/components/portfolio-gallery";
import { Eyebrow } from "@/components/ui";
import { STUDIO_SHOWCASES, toPortfolioProject } from "@/lib/portfolio";
import { publicDb } from "@/lib/supabase";
import type { Content } from "@/lib/model";

export const metadata: Metadata = {
  title: "3D Portfolio",
  description: "Explore Obsidian Research projects and studio showcases in an interactive gallery.",
};

export default async function Portfolio() {
  await connection();
  const { data } = await publicDb()?.from("site_content").select("*").eq("kind", "portfolio").eq("published", true)
    .order("position").order("updated_at", { ascending: false }).limit(60) ?? {};
  const projects = (data as Content[] | undefined)?.map(toPortfolioProject) ?? [];
  const exhibits = projects.length ? projects : STUDIO_SHOWCASES;
  return <section className="portfolio-page">
    <div className="wrap">
      <header className="portfolio-intro">
        <Eyebrow>Obsidian Research / Selected work</Eyebrow>
        <h1>Step inside<br />our portfolio.</h1>
        <p>Browse interiors, connected spaces and power solutions in an interactive project gallery.</p>
      </header>
      <PortfolioGallery key={exhibits.map(({ id }) => id).join(",")} projects={exhibits} />
    </div>
  </section>;
}
