import type { Metadata } from "next";
import { ButtonLink, Empty, Intro } from "@/components/ui";
import { CourseCard } from "@/components/catalog";
import { catalog } from "@/lib/catalog";
import { courseState } from "@/lib/model";

export const metadata: Metadata = { title: "Training & Academy", description: "Explore practical training in networking and financial markets. See availability, registration fees and course details." };

export default async function Training({ searchParams }: { searchParams: Promise<{ category?: string; status?: string }> }) {
  const [{ courses, offers, available }, filters] = await Promise.all([catalog(), searchParams]);
  const categories = [...new Set(courses.map((course) => course.category))];
  const shown = courses.filter((course) => (!filters.category || course.category === filters.category)
    && (filters.status !== "open" || courseState(course).open));
  return <>
    <Intro label="Obsidian Academy" title="Training & Academy">Choose a program, review the curriculum and fees, and apply through your Obsidian account.</Intro>
    <section className="section-compact"><div className="wrap">
      {courses.length > 0 && <form className="filter-form" action="/training" aria-label="Filter training programs">
        <label className="field">Category<select name="category" defaultValue={filters.category ?? ""}><option value="">All categories</option>
          {categories.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="field">Availability<select name="status" defaultValue={filters.status ?? ""}><option value="">All programs</option><option value="open">Accepting applications</option></select></label>
        <button className="button button-dark" type="submit">Filter courses</button>
      </form>}
      {shown.length ? <div className="course-grid">{shown.map((course) => <CourseCard key={course.id} course={course}
        offer={offers.find((offer) => offer.course_id === course.id)} />)}</div>
        : <Empty title={available ? "No matching programs" : "Training catalogue unavailable"}><ButtonLink href={courses.length ? "/training" : "/contact"}>{courses.length ? "Clear filters" : "Contact the training centre"}</ButtonLink></Empty>}
    </div></section>
  </>;
}
