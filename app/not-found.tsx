import { ButtonLink, Intro } from "@/components/ui";

export default function NotFound() {
  return <><Intro label="404" title="That page isn’t available">The page may have moved or the course may have been unpublished.</Intro>
    <div className="section-compact"><div className="wrap row"><ButtonLink href="/">Return home</ButtonLink><ButtonLink href="/training" variant="ghost">Browse training</ButtonLink></div></div>
  </>;
}
