import type { Metadata, Viewport } from "next";
import { Footer, Header } from "@/components/shell";
import { MobileTabs } from "@/components/app-navigation";
import "./globals.css";

const canonical = process.env.NEXT_PUBLIC_SITE_URL || "https://www.obsidianresearch.si";
export const metadata: Metadata = {
  metadataBase: new URL(canonical),
  title: { default: "Obsidian Research | Technology, Consulting & Training", template: "%s | Obsidian Research" },
  description: "Technology solutions, professional training, and practical expertise in Katsina, Nigeria. Explore services and apply for training.",
  applicationName: "Obsidian Research",
  appleWebApp: { capable: true, title: "Obsidian", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/obsidian-180.png" },
  openGraph: {
    type: "website", siteName: "Obsidian Research",
    images: [{ url: "/media/social.jpg", width: 1200, height: 630, alt: "Obsidian Research training and technology" }],
  },
  twitter: { card: "summary_large_image", images: ["/media/social.jpg"] },
};

export const viewport: Viewport = { themeColor: "#070b15", viewportFit: "cover" };

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>
    <a href="#main" className="skip-link">Skip to content</a><Header />
    <main id="main">{children}</main><Footer /><MobileTabs />
  </body></html>;
}
