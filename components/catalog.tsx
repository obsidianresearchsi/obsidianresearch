import Link from "next/link";
import {
  ArrowUpRight, BrainCircuit, Building2, CodeXml, Compass, GraduationCap,
  Network, Orbit, Presentation, RadioTower, Sun, TrendingUp, type LucideIcon,
} from "lucide-react";
import { courseCover } from "@/lib/catalog";
import { calendar, courseState, displayMode, money, offerText, servicePrice, type Content, type Course, type Offer } from "@/lib/model";
import { RegistrationBadge, RegistrationCountdown, RegistrationGate } from "./registration-clock";

const icons: Record<string, LucideIcon> = {
  "ai-machine-learning": BrainCircuit, "advanced-networking": Network, "web-mobile-design": CodeXml,
  "hajj-umrah": Compass, "forex-crypto-meetups": TrendingUp, starlink: RadioTower,
  "interior-design": Building2, consultation: Presentation, "solar-power": Sun,
};

export function ServiceIcon({ slug, size = 24 }: { slug: string; size?: number }) {
  const Icon = icons[slug] || Orbit;
  return <Icon size={size} strokeWidth={1.6} aria-hidden />;
}

export function ServiceCard({ service, i }: { service: Content; i: number }) {
  const price = servicePrice(service);
  return <Link href={`/services/${service.slug}`} className="service-card">
    <div className="service-card-top"><span className="service-icon"><ServiceIcon slug={service.slug} /></span>
      <span className="service-index">{String(i + 1).padStart(2, "0")}</span></div>
    <h3>{service.title}</h3><p>{service.summary}</p>{price !== null && <strong>{money(price)}</strong>}<span className="text-link">Explore service <ArrowUpRight size={16} aria-hidden /></span>
  </Link>;
}

export function CourseCard({ course, offer }: { course: Course; offer?: Offer }) {
  const state = courseState(course);
  return <article className={`course-card course-${course.accent}`}>
    <div className="course-image">
      {/* These WebP covers are pre-sized and may be served by Supabase Storage. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={courseCover(course)} alt="" loading="lazy" />
      <RegistrationBadge open={state.open} deadline={course.registration_deadline} label={state.label} />
    </div>
    <div className="course-content">
      <p className="course-category"><GraduationCap size={16} aria-hidden /> {course.category}</p>
      <h3><Link href={`/training/${course.slug}`}>{course.title}</Link></h3>
      <p>{course.summary}</p>
      <div className="course-meta"><span><small>Format</small>{displayMode(course.mode)}</span><span><small>Duration</small>{course.duration || "To be announced"}</span></div>
      {course.starts_at && <p className="small muted">Starts {calendar(course.starts_at)}</p>}
      <RegistrationCountdown open={state.open} deadline={course.registration_deadline} spots={state.spots} initialTime={Date.now()} />
      {offer && <RegistrationGate deadline={course.registration_deadline}><div className="offer-strip">
        {offerText(offer)}{offer.remaining !== null && <span>{offer.remaining} offers left</span>}
      </div></RegistrationGate>}
      <div className="course-footer"><div><small>Registration fee</small><strong>{money(course.fee_kobo)}</strong></div>
        <div className="row">
          <Link className="text-link" href={`/training/${course.slug}`}>Course details <ArrowUpRight size={17} aria-hidden /></Link>
          {state.open && <RegistrationGate deadline={course.registration_deadline}>
            <Link className="button button-primary" href={`/apply/${course.slug}`}>Apply</Link>
          </RegistrationGate>}
        </div>
      </div>
    </div>
  </article>;
}
