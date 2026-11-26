"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CustomerProvider } from "./customer-account";
import { SiteHeader } from "./site-header";
import { MotionRoot, RouteEntrance } from "./motion-system";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import { BrandLogo } from "./brand-logo";
import { AskInox } from "./ask-inox";
export function Brand() {
  return (
    <Link className="brand" href="/" aria-label="INOX home">
      <BrandLogo />
    </Link>
  );
}
export function Header() {
  return <SiteHeader />;
}
export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-grid">
        <div>
          <Brand />
          <p>
            Considered details.
            <br />
            Extraordinary everyday spaces.
          </p>
        </div>
        <div>
          <span className="eyebrow">Explore <mark className="inox-word">INOX</mark></span>
          <Link href="/about">Our story</Link>
          <Link href="/products">Our solutions</Link>
          <Link href="/catalogues">Catalogues</Link>
          <Link href="/blog">Blog</Link>
        </div>
        <div>
          <span className="eyebrow">Let’s connect</span>
          <Link href="/contact">
            Project enquiries <ArrowUpRight size={14} />
          </Link>
          <Link href="/contact?type=partner">Become a partner</Link>
          <Link href="/admin">Partner administration</Link>
          <p>
            Address: Plot No.1/2, Block B-1,
            <br />
            Main, Najafgarh Rd, Janakpuri
            <br />
            East, New Delhi, Delhi 110058.
          </p>
        </div>
        <div>
          <span className="eyebrow">A space for possibility</span>
          <h3>
            Good design begins
            <br />
            with a conversation.
          </h3>
          <Link className="text-link" href="/contact">
            Start yours <ArrowRight size={17} />
          </Link>
        </div>
      </div>
      <div className="wrap footer-bottom">
        <span>
          © {new Date().getFullYear()} <mark className="inox-word">INOX</mark> Decor. All rights reserved.
        </span>
        <Link href="/privacy">Privacy policy</Link>
      </div>
    </footer>
  );
}
export function SiteShell({ children, askInoxEnabled = false }: { children: React.ReactNode; askInoxEnabled?: boolean }) {
  const path = usePathname();
  if (path.startsWith("/admin")) return <>{children}</>;
  if (path === "/ask-inox-widget") return <CustomerProvider><MotionRoot>{askInoxEnabled && <AskInox embedded />}</MotionRoot></CustomerProvider>;
  return (
    <CustomerProvider><MotionRoot>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header />
      <RouteEntrance>{children}</RouteEntrance>
      <Footer />
      {askInoxEnabled && <AskInox />}
      <a className="whatsapp-float" href="https://wa.me/919717756063?text=Hii" target="_blank" rel="noopener noreferrer" aria-label="Chat with INOX on WhatsApp, +91 9717756063 (opens in a new tab)">
        <span className="whatsapp-float-label" aria-hidden="true">Chat with INOX</span>
        <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path d="M26.5 15.5a11 11 0 0 1-16.4 9.6L4 27l1.9-6.1A11 11 0 1 1 26.5 15.5Z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
          <path d="M12 9.8c-.3-.7-.6-.7-.9-.7h-.7c-.3 0-.7.1-1 .5-.4.4-1.3 1.3-1.3 3.1s1.3 3.5 1.5 3.8c.2.2 2.6 4.1 6.4 5.5 3.1 1.2 3.8.9 4.5.8.7-.1 2.2-.9 2.5-1.8.3-.9.3-1.6.2-1.8-.1-.2-.4-.3-.9-.6l-2.6-1.2c-.3-.1-.6-.2-.9.2l-1.2 1.5c-.2.3-.5.3-.9.1-.4-.2-1.8-.7-3.3-2.1-1.2-1.1-2.1-2.4-2.3-2.8-.2-.4 0-.6.2-.8l.6-.8c.2-.3.3-.5.4-.7.1-.3.1-.5 0-.7l-1.1-2.5Z" fill="currentColor" transform="translate(2 1) scale(.82)" />
        </svg>
      </a>
    </MotionRoot></CustomerProvider>
  );
}
