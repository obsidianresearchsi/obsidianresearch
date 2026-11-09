import Link from "next/link";
import Image from "next/image";
import { MessageCircle } from "lucide-react";
import { company, DEFAULT_COMPANY, detail, TAGLINE } from "@/lib/catalog";
import { HeaderNavigation } from "./app-navigation";
import { InstallApp } from "./install-app";

const navigation = [
  { label: "Services", href: "/services" }, { label: "Training", href: "/training" },
  { label: "News", href: "/news" }, { label: "About", href: "/about" }, { label: "Contact", href: "/contact" },
];

export function Logo({ dark = false }: { dark?: boolean }) {
  return <Image className="wordmark" width={174} height={31} src={dark ? "/media/logo-black.png" : "/media/logo-white.png"}
    alt="Obsidian Research" priority />;
}

export function Header() {
  return <header className="site-header"><div className="wrap navigation">
    <Link href="/" className="logo-link" aria-label="Obsidian Research home"><Logo /></Link>
    <HeaderNavigation links={navigation} />
  </div></header>;
}

export async function Footer() {
  const info = await company();
  const phone = detail(info, "phone", DEFAULT_COMPANY.details.phone as string);
  const number = phone.replace(/\D/g, "");
  const email = detail(info,"email",String(DEFAULT_COMPANY.details.email));
  const year = new Intl.DateTimeFormat("en-NG",{year:"numeric",timeZone:"Africa/Lagos"}).format(new Date());
  return <footer className="site-footer"><div className="wrap">
    <div className="footer-grid">
      <div><Link href="/" aria-label="Obsidian Research home"><Logo /></Link><p>{detail(info, "tagline", TAGLINE)}</p></div>
      <div><h2>Explore</h2>{navigation.map(({ label, href }) => <Link key={href} href={href}>{label}</Link>)}</div>
      <div><h2>Account & resources</h2><Link href="/dashboard">My Workspace</Link><Link href="/policies">Training policies</Link><Link href="/admin">Staff console</Link><InstallApp /></div>
      <div><h2>Katsina training centre</h2><p>{detail(info, "address", DEFAULT_COMPANY.details.address as string)}</p>
        <a href={`https://wa.me/${number}`}><MessageCircle size={16} aria-hidden /> {phone}</a>
        <a href={`mailto:${email}`}>{email}</a>
      </div>
    </div>
    <div className="footer-bottom"><span>© {year} Obsidian Research</span><Link href="/policies#privacy">Privacy</Link></div>
  </div></footer>;
}
