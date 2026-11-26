"use client";
import { useEffect, useState } from "react";
import type { CustomerActivity } from "@/lib/customer-enquiry-model";
type Customer = { id: string; name: string; email: string; mobile: string; company: string; registeredAt: string; first_login: string | null; last_login: string | null; login_count: number; activeSessions: number; enquiryCount: number };
export function WebsiteCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]), [search, setSearch] = useState(""), [error, setError] = useState(""), [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<CustomerActivity[]>([]), [customerId, setCustomerId] = useState("");
  async function load() {
    setLoading(true); setError("");
    try { const r = await fetch(`/api/admin/website-customers${customerId ? `?customerId=${encodeURIComponent(customerId)}` : ""}`, { cache: "no-store" }); const data = await r.json(); if (!r.ok) throw new Error(data.message); setCustomers(data.customers); setActivity(data.activity); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load customers."); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [customerId]);
  const filtered = customers.filter(c => `${c.name} ${c.email} ${c.mobile} ${c.company}`.toLowerCase().includes(search.toLowerCase()));
  const date = (value: string | null) => value ? new Date(value).toLocaleString("en-IN") : "Not signed in";
  return <section className="table-panel">
    <div className="catalogue-toolbar"><label>Search website customers<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, email, mobile or company" /></label><button className="button outline" disabled={loading} onClick={load}>Refresh</button></div>
    <p>Website accounts, sign-ins and saved enquiries. Showing up to 1,000 most recently active accounts. Active sessions indicate valid sign-ins, not live presence.</p>
    {error ? <p role="alert" className="form-error">{error}</p> : loading ? <p role="status">Loading customers…</p> : <>
      <p>{filtered.length} customers · {customers.filter(c => c.activeSessions > 0).length} with active sessions · {customers.reduce((sum, c) => sum + c.enquiryCount, 0)} saved enquiries</p>
      <div className="table-scroll"><table><thead><tr><th>Customer</th><th>Contact</th><th>Registered</th><th>First sign-in</th><th>Last sign-in</th><th>Sign-ins</th><th>Active sessions</th><th>Enquiries</th><th>Activity</th></tr></thead><tbody>{filtered.map(c => <tr key={c.id}>
        <td>{c.name || "—"}<br /><small>{c.company}</small></td><td>{c.email}<br />{c.mobile}</td><td>{date(c.registeredAt)}</td><td>{date(c.first_login)}</td><td>{date(c.last_login)}</td><td>{c.login_count}</td><td>{c.activeSessions}</td><td>{c.enquiryCount}</td><td><button className="text-link" onClick={() => setCustomerId(c.id)}>View activity</button></td>
      </tr>)}</tbody></table></div>{!filtered.length && <p>No website customers found.</p>}
      <div className="catalogue-toolbar"><h3>Recent account activity</h3><label>Activity for<select value={customerId} onChange={e => setCustomerId(e.target.value)}><option value="">All customers</option>{customers.map(c => <option value={c.id} key={c.id}>{c.email}</option>)}</select></label></div>
      <p>The latest 100 recorded events. Detailed activity starts when this feature is enabled; earlier sign-in totals remain available above.</p>
      <div className="table-scroll"><table><thead><tr><th>When</th><th>Customer</th><th>Activity</th><th>Enquiry reference</th></tr></thead><tbody>{activity.map(a => <tr key={a.id}><td>{date(a.createdAt)}</td><td>{a.email}</td><td>{a.event}</td><td>{a.enquiryId || "—"}</td></tr>)}</tbody></table></div>{!activity.length && <p>No recorded activity yet.</p>}
    </>}
  </section>;
}
