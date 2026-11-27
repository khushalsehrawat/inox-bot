"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { HighlightInox } from "./highlight-inox";
import { ArrowRight, Trash2, ShoppingBag } from "lucide-react";
import { products as referenceProducts, type Product } from "@/lib/data";
import { readBasket, saveBasket, type BasketItem } from "@/lib/basket";
import { useCustomer } from "./customer-account";
export function EnquiryForm({ basket = false, products = referenceProducts, mainSite = false }: { basket?: boolean; products?: Product[]; mainSite?:boolean }) {
  const { user, ready } = useCustomer();
  const formRef = useRef<HTMLFormElement>(null);
  const [savedToAccount, setSavedToAccount] = useState(false);
  const [items, setItems] = useState<BasketItem[]>([]),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setItems(readBasket());
    const sync = () => setItems(readBasket());
    window.addEventListener("basket-change", sync);
    return () => window.removeEventListener("basket-change", sync);
  }, []);
  useEffect(() => {
    if (!user || !formRef.current) return;
    const values = { name: [user.profile?.firstName, user.profile?.lastName].filter(Boolean).join(" "), email: user.email, phone: [user.profile?.countryCode, user.profile?.mobile].filter(Boolean).join(" "), company: user.profile?.companyName || "" };
    for (const [name, value] of Object.entries(values)) {
      const input = formRef.current.elements.namedItem(name);
      if (input instanceof HTMLInputElement && !input.value) input.value = value;
    }
  }, [user?.id]);
  function update(next: BasketItem[]) {
    setItems(next);
    saveBasket(next);
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setSavedToAccount(false);
    const form = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...Object.fromEntries(form), items }),
      });
      const data = await r.json();
      setSavedToAccount(r.ok && data.savedToAccount === true);
      setMessage(
        data.message || "Enquiry service unavailable. Please try again later.",
      );
    } catch {
      setMessage(
        "The enquiry could not be sent. Your basket is saved on this device.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="enquiry-layout">
      {mainSite && <p role="status">Review your selections here, then open each exact variant on the main website to add it to your main-site enquiry. Your basket is not transferred automatically.</p>}
      {basket && (
        <section className="basket-panel">
          <span className="eyebrow">Your selection</span>
          <h2>Made for your project.</h2>
          {items.length ? (
            items.map((item) => (
              <div className="basket-item" key={`${item.id}:${item.variationId || ""}`}>
                <div>
                  <h3>
                    {products.find((p) => p.id === item.id)?.name || item.id}
                  </h3>
                  <small>{products.find((p) => p.id === item.id)?.variations?.find(v=>v.id===item.variationId)?.sku || products.find((p) => p.id === item.id)?.sku}</small>
                </div>
                {mainSite && <a href={`https://inoxdecor.com/products/${encodeURIComponent(item.id)}${item.variationId?`?variation=${encodeURIComponent(item.variationId)}`:""}`} target="_blank" rel="noreferrer">Open this variant on main site</a>}
                <label>
                  Quantity
                  <input
                    aria-label={`Quantity for ${products.find((p) => p.id === item.id)?.name}`}
                    type="number"
                    min="1"
                    max="999"
                    value={item.quantity}
                    onChange={(e) => {
                      const q = Number(e.target.value);
                      if (Number.isInteger(q) && q > 0 && q <= 999)
                        update(
                          items.map((i) =>
                            i.id === item.id && i.variationId === item.variationId ? { ...i, quantity: q } : i,
                          ),
                        );
                    }}
                  />
                </label>
                <button
                  className="icon-button"
                  aria-label="Remove product"
                  onClick={() => update(items.filter((i) => i.id !== item.id || i.variationId !== item.variationId))}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <ShoppingBag size={32} />
              <p>Your enquiry basket is empty.</p>
              <Link className="text-link" href="/products">
                Explore products <ArrowRight size={16} />
              </Link>
            </div>
          )}
          <Link className="text-link" href="/products">
            Continue exploring <ArrowRight size={15} />
          </Link>
        </section>
      )}
      {!mainSite && <form ref={formRef} className="enquiry-form" onSubmit={submit}>
        <span className="eyebrow">Tell us about your project</span>
        <h2>
          Let’s make room
          <br />
          for your ideas.
        </h2>
        <div className="form-grid">
          <label>
            Full name
            <input name="name" autoComplete="name" maxLength={120} required />
          </label>
          <label>
            Company
            <input name="company" autoComplete="organization" maxLength={160} />
          </label>
          <label>
            Email address
            <input
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
            />
          </label>
          <label>
            Phone number
            <input
              name="phone"
              type="tel"
              autoComplete="tel"
              maxLength={30}
              required
            />
          </label>
          <label>
            City / Project location
            <input name="city" autoComplete="address-level2" maxLength={160} />
          </label>
          <label>
            Enquiry type
            <select name="type">
              <option>Project enquiry</option>
              <option>Product information</option>
              <option>Become a partner</option>
            </select>
          </label>
        </div>
        <label>
          Your message
          <textarea name="message" rows={4} maxLength={3000} required />
        </label>
        <label className="honeypot" aria-hidden="true">
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
        <label className="check-label">
          <input type="checkbox" name="consent" required />I agree to be
          contacted by <mark className="inox-word">INOX</mark> about this enquiry.
        </label>
        <p className="integration-note">
          {user ? "Your submitted enquiry will be saved to your INOX account, so you can revisit it on any device." : <>Your enquiry will reach our team. <Link className="text-link" href="/login?next=%2Fenquiry">Sign in</Link> before sending to also save it to your account.</>}
        </p>
        <div className="form-actions">
          <button className="button dark" disabled={busy || !ready}>
            {busy ? "Sending…" : "Send enquiry"}
            <ArrowRight size={16} />
          </button>
        </div>
        {message && (
          <p className="form-feedback" role="status">
            <HighlightInox text={message}/>
          </p>
        )}
        {savedToAccount && <Link className="text-link" href="/account">View your saved enquiries <ArrowRight size={15} /></Link>}
      </form>}
    </div>
  );
}
