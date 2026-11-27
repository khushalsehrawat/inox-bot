import { mainSiteConnected } from "@/lib/main-site-catalogue";
import type { Metadata } from "next";
import Script from "next/script";
import { SiteShell } from "@/components/site-shell";
import "./globals.css";
import "./materials.css";
import { publicCategories } from "@/lib/public-site";
import { askInoxEnabled } from "@/lib/ask-inox-enabled";
import { WebTaxonomyProvider } from "@/components/web-taxonomy-provider";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: {
    default: "INOX Decor — Considered details. Extraordinary spaces.",
    template: "%s | INOX Decor",
  },
  description:
    "Discover INOX kitchen accessories, wardrobe fittings, architectural hardware and interior solutions.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  ),
  openGraph: {
    type: "website",
    siteName: "INOX Decor",
    images: ["/media/editorial/editorial-kitchen.webp"],
  },
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const catalogue = await publicCategories();
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <Script id="gtm-data-layer" strategy="beforeInteractive">
          {`window.dataLayer = window.dataLayer || [];
            window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
`}
        </Script>
        <Script
          id="google-tag-manager"
          src="https://www.googletagmanager.com/gtm.js?id=GTM-WZTSLDZQ"
          strategy="afterInteractive"
        />
        <WebTaxonomyProvider initialCategories={catalogue.data}>
          <SiteShell askInoxEnabled={askInoxEnabled()}>{mainSiteConnected() && <aside role="status" className="wrap" style={{padding:"12px 20px"}}>Connected to the published catalogue at <a href="https://inoxdecor.com" target="_blank" rel="noreferrer">inoxdecor.com</a>. Complete product enquiries on the main website.</aside>}{!catalogue.available && <aside role="status" className="wrap" style={{padding:"12px 20px"}}>The live catalogue is temporarily unavailable. Ask INOX can still help with our brand and public website information.</aside>}{children}</SiteShell>
        </WebTaxonomyProvider>
      </body>
    </html>
  );
}
