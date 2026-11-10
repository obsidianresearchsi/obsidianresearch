import Link from "next/link";
import {
  archiveCourse, removeModule, saveBatch, saveContent, saveCourse, saveDiscount, saveModule,
} from "@/app/admin/actions";
import { ActionForm } from "./action-form";
import { EditorialFields } from "./editorial-fields";
import { Badge, Check, Field, Select, Textarea } from "./ui";
import { detail, detailsList } from "@/lib/catalog";
import { money, servicePrice, type Batch, type Content, type Course, type Discount, type Module } from "@/lib/model";
import { SOLAR_RATES, SOLAR_SERVICE, solarAppliances, solarPrices } from "@/lib/solar";
import { PortfolioMediaFields } from "./portfolio-media-fields";
import { INTERIOR_RATES, INTERIOR_SERVICE, interiorPrices } from "@/lib/interior";
import { NETWORK_RATES, NETWORK_SERVICE, networkPrices } from "@/lib/network";

const naira = (kobo: number | null | undefined) => kobo == null ? "" : String(kobo / 100);
const dateTime = (value: string | null | undefined) => value ? new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Africa/Lagos", dateStyle: "short", timeStyle: "short",
}).format(new Date(value)).replace(" ","T") : "";

export function CourseEditor({ course, modules, batches, discounts }: {
  course?: Course; modules: Module[]; batches: Batch[]; discounts: Discount[];
}) {
  return <>
    <section className="panel"><h2>Course information</h2>
      <ActionForm action={saveCourse} submit={course ? "Save course" : "Create course"}>
        <input type="hidden" name="id" value={course?.id ?? ""} />
        <input type="hidden" name="cover_url" value={course?.cover_url ?? ""} />
        <div className="form-grid">
          <Field label="Course title" name="title" defaultValue={course?.title} maxLength={150} required />
          <Field label="URL slug" name="slug" defaultValue={course?.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={90} required />
          <Field label="Category" name="category" defaultValue={course?.category} maxLength={90} required />
          <Select label="Program accent" name="accent" defaultValue={course?.accent ?? "blue"}><option value="blue">Network blue</option><option value="gold">Market gold</option></Select>
        </div>
        <Textarea label="Listing summary" name="summary" defaultValue={course?.summary} maxLength={400} rows={2} required />
        <Textarea label="Program description" name="description" defaultValue={course?.description} maxLength={8000} rows={4} />
        <Textarea label="Learning objectives" name="objectives" defaultValue={course?.objectives.join("\n")} maxLength={2000} hint="One objective per line." />
        <div className="form-grid">
          <Textarea label="Requirements" name="requirements" defaultValue={course?.requirements} maxLength={2500} />
          <Textarea label="Schedule notes" name="schedule" defaultValue={course?.schedule} maxLength={2500} />
        </div>
        <Textarea label="Course FAQs" name="faq" defaultValue={course?.faq} maxLength={2500} />
        <div className="form-grid">
          <Select label="Training format" name="mode" defaultValue={course?.mode || ""}>
            <option value="">To be announced</option><option value="physical">Physical</option><option value="online">Online</option><option value="hybrid">Hybrid</option>
          </Select>
          <Field label="Duration" name="duration" defaultValue={course?.duration ?? ""} maxLength={80} />
          <Field label="Commencement date" name="starts_at" type="date" defaultValue={course?.starts_at ?? ""} />
          <Field label="Registration countdown ends (Lagos time)" name="deadline" type="datetime-local" defaultValue={dateTime(course?.registration_deadline)}
            hint="Set a deadline to show the countdown and close applications automatically. Leave blank to remove the timer." />
          <Field label="Registration fee (NGN)" name="fee" inputMode="decimal" defaultValue={naira(course?.fee_kobo)} required />
          <Field label="Minimum installment (NGN)" name="installment" inputMode="decimal" defaultValue={naira(course?.installment_min_kobo)} hint="Leave blank for full payment only." />
          <Field label="Class capacity" name="capacity" type="number" min={1} max={100000} defaultValue={course?.capacity ?? ""}
            hint="Customers see the remaining places. Applications close when the class is full." />
          <Select label="Program phase" name="phase" defaultValue={course?.phase ?? "upcoming"}>
            <option value="upcoming">Upcoming</option><option value="starting_soon">Starting soon</option><option value="running">Currently running</option><option value="completed">Completed</option>
          </Select>
        </div>
        <Field label="Cover image" name="cover" type="file" accept="image/png,image/jpeg,image/webp" hint="JPEG, PNG or WebP, up to 2 MB. A program cover is used by default." />
        <Check name="published" defaultChecked={course?.published}>Publish this course in the academy</Check>
        <Check name="registrations_open" defaultChecked={course?.registrations_open}>Accept applications when the course is published</Check>
        <Check name="identity_requested" defaultChecked={course?.identity_requested}>Request optional identity evidence for this course</Check>
      </ActionForm>
    </section>
    {course && <>
      <section className="panel stack"><div className="panel-title"><h2>Curriculum</h2><Badge>{modules.length} modules</Badge></div>
        {modules.map((module) => <details className="panel" key={module.id}><summary>{module.position}. {module.title}</summary>
          <div className="stack mt-4"><ModuleEditor course={course.id} module={module} />
            <ActionForm action={removeModule} submit="Remove module" tone="ghost" confirm="Remove this module from the published curriculum?">
              <input type="hidden" name="id" value={module.id} />
            </ActionForm></div></details>)}
        <details className="panel"><summary>Add a module</summary><div className="mt-4"><ModuleEditor course={course.id}
          next={(modules.at(-1)?.position ?? 0) + 1} /></div></details>
      </section>
      <section className="panel stack"><h2>Training batches</h2>
        {batches.map((batch) => <details className="panel" key={batch.id}><summary>{batch.name}</summary>
          <div className="mt-4"><BatchEditor course={course.id} batch={batch} /></div></details>)}
        <details className="panel"><summary>Add a batch</summary><div className="mt-4"><BatchEditor course={course.id} /></div></details>
      </section>
      <section className="panel stack" id="coupons"><h2>Coupons & promotions</h2>
        <p className="muted">A course can have one automatic offer and multiple coupons. Each code has its own expiry and usage limit.</p>
        {discounts.map((discount) => <details className="panel" key={discount.id}>
          <summary>{discount.label} · {discount.coupon_code || "Automatic"} · {discount.kind === "percent" ? `${discount.value}%` : money(discount.value)} · {discount.claimed}{discount.claim_limit ? ` / ${discount.claim_limit}` : ""} used</summary>
          <div className="mt-4"><DiscountEditor course={course.id} discount={discount} /></div>
        </details>)}
        <details className="panel"><summary>Create a coupon or automatic offer</summary><div className="mt-4"><DiscountEditor course={course.id} /></div></details>
      </section>
      <section className="panel"><h2>{course.archived ? "Restore course" : "Archive course"}</h2>
        <ActionForm action={archiveCourse} submit={course.archived ? "Restore as draft" : "Archive course"} tone="ghost"
          confirm={course.archived ? undefined : "Archive this course and close registrations?"}>
          <input type="hidden" name="id" value={course.id} /><input type="hidden" name="archived" value={String(!course.archived)} />
        </ActionForm>
      </section>
    </>}
  </>;
}

function ModuleEditor({ course, module, next = 1 }: { course: string; module?: Module; next?: number }) {
  return <ActionForm action={saveModule} submit={module ? "Save module" : "Add module"} tone="dark">
    <input type="hidden" name="id" value={module?.id ?? ""} /><input type="hidden" name="course_id" value={course} />
    <div className="form-grid"><Field label="Order" name="position" type="number" min={1} max={500} defaultValue={module?.position ?? next} required />
      <Field label="Module title" name="title" defaultValue={module?.title} maxLength={200} required /></div>
    <Textarea label="Description" name="description" defaultValue={module?.description} maxLength={2000} />
  </ActionForm>;
}

function BatchEditor({ course, batch }: { course: string; batch?: Batch }) {
  return <ActionForm action={saveBatch} submit={batch ? "Save batch" : "Add batch"} tone="dark">
    <input type="hidden" name="id" value={batch?.id ?? ""} /><input type="hidden" name="course_id" value={course} />
    <div className="form-grid"><Field label="Batch name" name="name" defaultValue={batch?.name} maxLength={100} required />
      <Field label="Starts" name="starts_at" type="date" defaultValue={batch?.starts_at ?? ""} /></div>
    <Textarea label="Batch schedule" name="schedule" defaultValue={batch?.schedule} maxLength={2000} />
    <Check name="accepting" defaultChecked={batch?.accepting ?? true}>Show as available to applicants</Check>
  </ActionForm>;
}

function DiscountEditor({ course, discount }: { course: string; discount?: Discount }) {
  return <ActionForm action={saveDiscount} submit={discount ? "Save promotion" : "Add promotion"} tone="dark">
    <input type="hidden" name="id" value={discount?.id ?? ""} /><input type="hidden" name="course_id" value={course} />
    <div className="form-grid">
      <Field label="Promotion label" name="label" defaultValue={discount?.label} maxLength={100} required />
      <Field label="Coupon code" name="coupon_code" defaultValue={discount?.coupon_code ?? ""} maxLength={32} hint="Leave blank to apply the offer automatically." />
      <Select label="Discount type" name="kind" defaultValue={discount?.kind ?? "percent"}><option value="percent">Percentage</option><option value="fixed">Fixed naira amount</option></Select>
      <Field label="Discount value" name="value" inputMode="decimal" defaultValue={discount ? discount.kind === "percent" ? discount.value : naira(discount.value) : ""} required />
      <Field label="Usage limit" name="limit" type="number" min={Math.max(1,discount?.claimed ?? 0)} defaultValue={discount?.claim_limit ?? ""} />
      <Field label="Starts (Lagos time)" name="starts" type="datetime-local" defaultValue={dateTime(discount?.starts_at)} />
      <Field label="Ends (Lagos time)" name="ends" type="datetime-local" defaultValue={dateTime(discount?.ends_at)} />
    </div>
    <Check name="active" defaultChecked={discount?.active}>Activate this promotion</Check>
  </ActionForm>;
}

export const CONTENT_KINDS = {
  company: "Company information", service: "Service", announcement: "Announcement",
  testimonial: "Testimonial", faq: "FAQ", promotion: "Campaign", article: "News article", portfolio: "Portfolio project",
} as const;
export type ContentKind = keyof typeof CONTENT_KINDS;

export function ContentEditor({ item, kind }: { item?: Content; kind: ContentKind }) {
  const empty = { details: {} };
  const value = (key: string) => detail(item ?? empty,key);
  const isSolar = kind === "service" && item?.slug === SOLAR_SERVICE;
  const isInterior = kind === "service" && item?.slug === INTERIOR_SERVICE;
  const isNetwork = kind === "service" && item?.slug === NETWORK_SERVICE;
  const estimator = isSolar ? { label: "Solar estimator prices", key: "solar", rates: SOLAR_RATES, prices: solarPrices(item.details.solar_prices) }
    : isInterior ? { label: "Interior studio prices", key: "interior", rates: INTERIOR_RATES, prices: interiorPrices(item.details.interior_prices) }
    : isNetwork ? { label: "Network Studio prices", key: "network", rates: NETWORK_RATES, prices: networkPrices(item.details.network_prices) } : null;
  return <section className="panel"><h2>{CONTENT_KINDS[kind]}</h2>
    <ActionForm action={saveContent} submit={item ? "Save content" : "Create content"}>
      <input type="hidden" name="id" value={item?.id ?? ""} /><input type="hidden" name="kind" value={kind} />
      <div className="form-grid">
        <Field label="Title" name="title" defaultValue={item?.title} maxLength={160} required />
        <Field label="URL slug" name="slug" defaultValue={item?.slug ?? (kind === "company" ? "profile" : "")} pattern="[a-z0-9]+(-[a-z0-9]+)*" readOnly={Boolean(estimator)} required />
      </div>
      <Textarea label={kind === "faq" ? "Answer" : "Summary"} name="summary" defaultValue={item?.summary} maxLength={600} required={kind==="article"} />
      {kind === "article" ? <>
        <Field label="Author byline" name="author" defaultValue={value("author") || "Obsidian Research"} maxLength={100} />
        <EditorialFields cover={value("cover_url")} alt={value("cover_alt")} initialBody={item?.body ?? ""} />
      </> : <Textarea label="Body" name="body" defaultValue={item?.body} maxLength={8000} rows={4} />}
      {kind === "portfolio" && <PortfolioMediaFields image={value("image_url")} video={value("video_url")} project={value("project_url")} />}
      {kind === "company" && <>
        <Field label="Official tagline" name="tagline" defaultValue={value("tagline")} maxLength={160} />
        <div className="form-grid">
          <Textarea label="Mission" name="mission" defaultValue={value("mission")} maxLength={600} />
          <Textarea label="Vision" name="vision" defaultValue={value("vision")} maxLength={600} />
          <Field label="Phone / WhatsApp" name="phone" type="tel" defaultValue={value("phone")} required />
          <Field label="Business email (optional)" name="email" type="email" defaultValue={value("email")} />
          <Field label="Website" name="website" type="url" defaultValue={value("website")} required />
          <Field label="Training centre address" name="address" defaultValue={value("address")} required />
        </div>
        <Field label="Homepage announcement banner" name="banner" defaultValue={value("banner")} maxLength={250} />
        <p className="small muted">Manage student payment instructions in <Link className="text-link" href="/admin/finance">Finance</Link>.</p>
      </>}
      {kind === "service" && <div className="form-grid">
        <Field label="Service price (NGN)" name="service_price" inputMode="decimal"
          defaultValue={item ? naira(servicePrice(item)) : ""} hint="Leave blank to provide a quote after reviewing the request." />
        <Textarea label="Offerings" name="offerings" defaultValue={item ? detailsList(item,"offerings").join("\n") : ""} hint="One per line." />
        <Textarea label="Benefits" name="benefits" defaultValue={item ? detailsList(item,"benefits").join("\n") : ""} hint="One per line." />
      </div>}
      {estimator && <fieldset className="fieldset" id={`${estimator.key}-prices`}>
        <legend>{estimator.label}</legend>
        <input type="hidden" name={`${estimator.key}_pricing`} value="on" />
        <p className="small muted">Enter a price per unit in naira. The public estimator uses these amounts to calculate a budget for review.</p>
        {isNetwork && <p className="small muted">Leave a rate blank to show Quote required. A wireless bridge uses two radios.</p>}
        <div className="form-grid">{estimator.rates.map(({ key, label }) => <Field key={key} label={label}
          name={`${estimator.key}_price_${key}`} type="number" min={0} max={50_000_000} step="0.01"
          inputMode="decimal" defaultValue={naira((estimator.prices as Record<string, number | null>)[key])} required={!isNetwork} />)}</div>
      </fieldset>}
      {isSolar && <details className="fieldset"><summary>Appliance catalogue wattages</summary>
        <input type="hidden" name="solar_ratings" value="on" />
        <p className="small muted">Set the typical running watts shown when customers select an appliance.</p>
        <div className="form-grid">{solarAppliances(item.details.solar_appliances).map((appliance) => <Field key={appliance.id}
          label={`${appliance.name} (W)`} name={`solar_watts_${appliance.id}`} type="number" min={1} max={25000} step={1} defaultValue={appliance.watts} />)}</div>
      </details>}
      {(kind === "announcement" || kind === "promotion") && <Field label="Link to a site page" name="href" placeholder="/training" defaultValue={value("href")} />}
      {kind === "testimonial" && <Check name="approved_testimonial" defaultChecked={item?.details.approved === true}>I verified the testimonial and have approval to publish it.</Check>}
      <Field label="Display order" name="position" type="number" min={0} max={1000} defaultValue={item?.position ?? 0} required />
      <Check name="published" defaultChecked={item?.published}>Publish on the website</Check>
    </ActionForm>
  </section>;
}
