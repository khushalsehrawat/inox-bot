"use client";
import { useCustomer } from "./customer-account";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimate, stagger } from "motion/react";
import { ArrowUpRight, ChevronDown, Menu, X, ShoppingBag } from "lucide-react";
import { useWebTaxonomy } from "./web-taxonomy-provider";
import { flattenCategories } from "@/lib/web-taxonomy-model";
import { readBasket } from "@/lib/basket";
import { editorialEase, useMotionPreferences } from "./motion-system";
import { BrandLogo } from "./brand-logo";
const links = [
  ["/", "Home"],
  ["/about", "About"],
  ["/products", "Products"],
  ["/honeycomb", "Honeycomb"],
  ["/catalogues", "Catalogues"],
  ["/blog", "Blog"],
  ["/contact", "Contact Us"],
];
export function SiteHeader() {
  const { user } = useCustomer();
  const categories = flattenCategories(useWebTaxonomy().categories);
  const path = usePathname();
  const [open, setOpen] = useState(false),
    [mobileCollections, setMobileCollections] = useState(false),
    [dropdown, setDropdown] = useState(false),
    [count, setCount] = useState(0);
  const { reduced, rich } = useMotionPreferences();
  const [scope, animate] = useAnimate();
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !scope.current?.contains(event.target)) {
        setOpen(false);
        setDropdown(false);
        setMobileCollections(false);
      }
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [scope]);
  useEffect(() => {
    setOpen(false);
    setDropdown(false);
    setMobileCollections(false);
  }, [path]);
  useEffect(() => {
    const update = () =>
      setCount(readBasket().reduce((sum, i) => sum + i.quantity, 0));
    update();
    window.addEventListener("basket-change", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("basket-change", update);
      window.removeEventListener("storage", update);
    };
  }, []);
  useEffect(() => {
    if (reduced) return;
    const controls = animate(
      ".header-brand, .desktop-nav > *, .header-actions",
      { opacity: [0, 1], y: [-7, 0] },
      { duration: 0.5, delay: stagger(0.045), ease: editorialEase },
    );
    return () => {
      controls.stop();
    };
  }, [reduced, animate]);
  useEffect(() => {
    if (rich) setOpen(false);
  }, [rich]);
  function close() {
    setOpen(false);
    setDropdown(false);
    setMobileCollections(false);
  }
  const navigation = (mobile = false) =>
    links.map(([href, label], index) => {
      const link = href === "/honeycomb" ? (
        <a href={href} onClick={close}>
          {label}
        </a>
      ) : (
        <Link
          href={href}
          aria-current={path === href || (href === "/blog" && path.startsWith("/blog/")) ? "page" : undefined}
          onClick={close}
        >
          {label}
        </Link>
      );
      if (mobile)
        return (
          <motion.div
            key={href}
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduced ? 0 : index * 0.035, duration: 0.28 }}
          >
            {href === "/products" ? <>
              <div className="mobile-products-row">
                {link}
                <button type="button" aria-label="Explore product collections" aria-expanded={mobileCollections} aria-controls="mobile-collections" onClick={() => setMobileCollections(current => !current)}>
                  <ChevronDown size={20}/>
                </button>
              </div>
              {mobileCollections && <div id="mobile-collections" className="mobile-collections">
                <Link href="/products" onClick={close}>View all products <ArrowUpRight size={15}/></Link>
                {categories.map(c => <Link key={c.id} className={c.parentId ? "is-subcategory" : undefined} href={`/products?category=${encodeURIComponent(c.id)}`} onClick={close}>{c.name}<ArrowUpRight size={14}/></Link>)}
              </div>}
            </> : link}
          </motion.div>
        );
      return href === "/products" ? (
        <div
          className="nav-product"
          key={href}
          onPointerLeave={(e) => { if (e.pointerType === "mouse") setDropdown(false); }}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setDropdown(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setDropdown(false);
              e.currentTarget.querySelector("button")?.focus();
            }
          }}
        >
          {link}
          <button
            type="button"
            aria-label="Explore product collections"
            aria-expanded={dropdown}
            aria-controls="collection-dropdown"
            onClick={() => setDropdown(!dropdown)}
          >
            <ChevronDown size={12} />
          </button>
          <AnimatePresence>
            {dropdown && (
              <motion.div
                id="collection-dropdown"
                className="collection-dropdown"
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduced ? 0 : 5 }}
                transition={{ duration: 0.2, ease: editorialEase }}
              >
                <span className="eyebrow">Considered collections</span>
                {categories.map((c) => (
                  <Link
                    key={c.id}
                    className={c.parentId ? "is-subcategory" : undefined}
                    href={`/products?category=${encodeURIComponent(c.id)}`}
                    onClick={close}
                  >
                    {c.name}
                    <ArrowUpRight size={13} />
                  </Link>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <div key={href}>{link}</div>
      );
    });
  return (
    <header ref={scope} className="header wrap">
      <Link className="brand header-brand" href="/" aria-label="INOX home">
        <BrandLogo priority />
      </Link>
      <nav aria-label="Main navigation" className="nav desktop-nav">
        {navigation()}
      </nav>
      <div className="header-actions">
        <Link className="customer-account-link" href={user ? "/account" : "/login"}>{user ? "My account" : "Sign in"}</Link>
        <Link
          className="enquiry-link"
          href="/enquiry"
          aria-label={`Enquiry basket${count ? `, ${count} items` : ""}`}
        >
          <ShoppingBag size={18} />
          <span>Enquiry</span>
          <AnimatePresence mode="popLayout">
            {count > 0 && (
              <motion.b
                key={count}
                className="basket-count"
                initial={reduced ? false : { opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduced ? 0 : -5 }}
                transition={{ duration: 0.2 }}
              >
                {count}
              </motion.b>
            )}
          </AnimatePresence>
        </Link>
        <Link className="button outline header-cta" href="/contact">
          Let’s build together <ArrowUpRight size={15} />
        </Link>
        <button
          ref={toggle}
          className="icon-button menu-button"
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => open ? close() : setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
            if (e.key === "Tab" && e.shiftKey && open) {
              const items = document.querySelectorAll<HTMLElement>("#mobile-navigation a, #mobile-navigation button");
              e.preventDefault();
              items[items.length - 1]?.focus();
            }
          }}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav
            id="mobile-navigation"
            aria-label="Main navigation"
            className="mobile-navigation"
            initial={
              reduced ? false : { opacity: 0, clipPath: "inset(0 0 100% 0)" }
            }
            animate={{ opacity: 1, clipPath: "inset(0 0 0% 0)" }}
            exit={{
              opacity: 0,
              clipPath: reduced ? "inset(0)" : "inset(0 0 100% 0)",
              pointerEvents: "none",
            }}
            transition={{ duration: reduced ? 0 : 0.3, ease: editorialEase }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                close();
                toggle.current?.focus();
              }
              if (e.key === "Tab") {
                const anchors = e.currentTarget.querySelectorAll("a, button");
                if (
                  !e.shiftKey &&
                  document.activeElement === anchors[anchors.length - 1]
                ) {
                  e.preventDefault();
                  toggle.current?.focus();
                }
                if (e.shiftKey && document.activeElement === anchors[0]) {
                  e.preventDefault();
                  toggle.current?.focus();
                }
              }
            }}
          >
            <span className="eyebrow">
              Explore <mark className="inox-word">INOX</mark>
            </span>
            {navigation(true)}
            <span className="mobile-menu-note">
              Considered details. Extraordinary spaces.
            </span>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
