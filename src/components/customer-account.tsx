"use client";
import { createContext, useContext, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CustomerEnquiries } from "./customer-enquiries";
type User = { id: string; email: string; profile?: { firstName?: string; lastName?: string; mobile?: string; countryCode?: string; companyName?: string } };
type PriceStatus = "idle" | "loading" | "ready" | "error";
const AccountContext = createContext<{ user: User | null; prices: Record<string, number>; mrps: Record<string, number>; priceStatus: PriceStatus; ready: boolean; clear: () => void; refresh: () => Promise<void> }>({ user: null, prices: {}, mrps: {}, priceStatus: "idle", ready: false, clear: () => {}, refresh: async () => {} });
export const useCustomer = () => useContext(AccountContext);
export function CustomerProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null), [prices, setPrices] = useState<Record<string, number>>({}), [mrps,setMrps]=useState<Record<string,number>>({}), [ready, setReady] = useState(false);
  const [priceStatus, setPriceStatus] = useState<PriceStatus>("idle");
  const generation=useRef(0);
  const customerId = useRef<string | null>(null);
  function clear() { generation.current++;customerId.current=null;setUser(null);setPrices({});setMrps({});setPriceStatus("idle");setReady(true); }
  async function refresh() {
    const run=++generation.current;
    try {
      const r = await fetch("/api/customer/session", { cache: "no-store" });
      if (!r.ok) throw new Error("Unable to check your session.");
      const data = await r.json();
      if(run !== generation.current)return;
      const changed = customerId.current !== (data.user?.id || null);
      customerId.current = data.user?.id || null;
      setUser(data.user || null);
      if (changed || !data.user) { setPrices({}); setMrps({}); setPriceStatus("idle"); }
      if (data.user) {
        setPriceStatus(previous => !changed && previous === "ready" ? "ready" : "loading");
        try {
          const response = await fetch("/api/customer/prices", { cache: "no-store" });
          if(run !== generation.current)return;
          if (response.status === 401) { clear(); return; }
          if (!response.ok) throw new Error("Unable to load prices.");
          const result = await response.json();
          if (!Array.isArray(result.prices)) throw new Error("Invalid price response.");
          const amounts:Record<string,number>={}, listMrps:Record<string,number>={};
          for (const p of result.prices) {
            if(p.amount === null) continue;
            if (typeof p.amount !== "number" || !Number.isFinite(p.amount)) throw new Error("Invalid price amount.");
            amounts[p.variation_id]=p.amount; listMrps[p.variation_id]=Math.round(Number(p.mrp)*100);
            if(p.isDefault){amounts[p.product_id]=p.amount;listMrps[p.product_id]=Math.round(Number(p.mrp)*100);}
          }
          if(run !== generation.current)return;
          setPrices(amounts);setMrps(listMrps);setPriceStatus("ready");
        } catch { if(run === generation.current)setPriceStatus("error"); }
      }
    } catch { if(run === generation.current)clear(); } finally { if(run === generation.current)setReady(true); }
  }
  useEffect(() => { void refresh(); const update = () => { void refresh(); }; const timer=window.setInterval(update,30000); window.addEventListener("focus", update); return () => {window.clearInterval(timer);window.removeEventListener("focus", update);}; }, []);
  return <AccountContext.Provider value={{ user, prices, mrps, priceStatus, ready, clear, refresh }}>{children}</AccountContext.Provider>;
}
export function ProductPrice({ id, variationId }: { id: string; variationId?: string }) {
  const { user, prices, mrps, priceStatus, ready, refresh } = useCustomer();
  const key = variationId || id;
  const format=(amount:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR"}).format(amount/100);
  if (!ready) return <p className="product-price">Checking price access…</p>;
  if (!user) return <p className="product-price"><Link href={`/login?next=${encodeURIComponent(`/products/${id}${variationId ? `?variation=${variationId}` : ""}`)}`}>Sign in to view price</Link></p>;
  if (priceStatus === "idle" || priceStatus === "loading") return <p className="product-price" role="status">Loading price…</p>;
  if (priceStatus === "error") return <p className="product-price" role="status">Unable to load prices. <button type="button" className="text-link" onClick={() => void refresh()}>Try again</button></p>;
  return <p className="product-price">{prices[key] === undefined ? "Price available on request" : <><strong>{format(prices[key])}</strong>{mrps[key] > prices[key] && <> <del>{format(mrps[key])}</del> ({Math.round((1-prices[key]/mrps[key])*100)}% off)</>}</>}</p>;
}
export function CustomerForm({ signup = false }: { signup?: boolean }) {
  const { user, ready, refresh, clear } = useCustomer(); const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [returnTo, setReturnTo] = useState("");
  useEffect(() => {
    setHydrated(true);
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next");
    setReturnTo(next && /^\/(?!\/)/.test(next) && !/[\u0000-\u0020\\]/.test(next) ? next : "");
    if (!signup && params.get("registered") === "1") setNotice("Account created. Please sign in.");
  }, [signup]);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false);
  async function request(action: string, body: unknown) {
    if(action === "logout")clear();
    const response = await fetch(`/api/customer/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json(); if (!response.ok) throw new Error(data.message || "Please try again."); return data;
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    const form = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (signup) {
        await request("register", { ...form, consentAccepted: form.consentAccepted === "on" });
        router.replace(`/login?registered=1${returnTo ? `&next=${encodeURIComponent(returnTo)}` : ""}`);
      } else {
        await request("login", form);
        await refresh();
        router.replace(returnTo || "/products"); router.refresh();
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); } finally { setBusy(false); }
  }
  if (!ready) return <main id="main" className="wrap inner-page customer-page"><p role="status">Checking your account…</p></main>;
  if (user) return <main id="main" className="wrap inner-page customer-page customer-dashboard"><section className="customer-card"><span className="eyebrow">Your INOX account</span><h1>Welcome, {user.profile?.firstName || "back"}.</h1><p>{user.email}</p><p>View product prices and return to your saved project enquiries at any time.</p><Link className="button dark" href="/products">Explore products</Link><button className="button outline" disabled={busy} onClick={async () => { setBusy(true); try { await request("logout", {}); await refresh(); router.refresh(); } catch { setError("Unable to sign out. Try again."); } finally { setBusy(false); } }}>Sign out</button>{error && <p role="alert">{error}</p>}</section><CustomerEnquiries key={user.id} /></main>;
  return <main id="main" className="wrap inner-page customer-page"><section className="customer-intro"><span className="eyebrow">A space for your next project</span><h1>Every detail.<br />Now within reach.</h1><p>Create your INOX account to view product prices. Explore materials, finishes and specifications at any time.</p></section><section className="customer-card"><span className="eyebrow">INOX customers</span><h2>{signup ? "Create your account." : "Welcome back."}</h2><p>{signup ? "Create your website account to get started." : "Sign in with your website account."}</p><form method="post" onSubmit={submit}>
    <>
      {signup && <div className="customer-fields"><label>First name<input name="firstName" required maxLength={100} autoComplete="given-name" /></label><label>Last name<input name="lastName" maxLength={100} autoComplete="family-name" /></label></div>}
      {signup && <label>Company name (optional)<input name="companyName" maxLength={200} autoComplete="organization" /></label>}
      <label>Email address<input name="email" type="email" required maxLength={254} autoComplete="email" /></label>
      {signup && <div className="customer-fields"><label>Country code<input name="countryCode" defaultValue="+91" required pattern="\+[0-9]{1,4}" maxLength={5} autoComplete="tel-country-code" /></label><label>Mobile number<input name="mobile" type="tel" required pattern="[0-9]{7,15}" maxLength={15} autoComplete="tel-national" /></label></div>}
      <label>Password<input name="password" type="password" required minLength={signup ? 8 : 1} maxLength={128} autoComplete={signup ? "new-password" : "current-password"} />{signup && <small>At least 8 characters, with letters, numbers and a symbol.</small>}</label>
      {signup && <label className="check-label"><input type="checkbox" name="consentAccepted" required />I agree to create an INOX account and use my details for account services.</label>}
    </>
    {error && <p role="alert" className="form-error">{error}</p>}{notice && <p role="status">{notice}</p>}
    <button className="button dark" disabled={busy || !hydrated}>{busy ? "Please wait…" : signup ? "Create account" : "Sign in"}</button>
  </form><p className="customer-account-prompt">{signup ? "Already have an account?" : <>New to <mark className="inox-word">INOX</mark>?</>} <Link className="customer-account-prompt-link" href={`${signup ? "/login" : "/signup"}${returnTo ? `?next=${encodeURIComponent(returnTo)}` : ""}`}>{signup ? "Sign in" : "Create an account"}</Link></p></section></main>;
}
