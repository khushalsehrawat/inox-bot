"use client";
import { useEffect, useState } from "react";
import { enquiryStatuses, type SavedEnquiry, type EnquiryStatus } from "@/lib/customer-enquiry-model";
import { EnquiryDetails } from "./enquiry-details";
type AdminEnquiry = SavedEnquiry & { accountEmail: string | null };
export function WebsiteEnquiriesAdmin() {
  const [enquiries, setEnquiries] = useState<AdminEnquiry[]>([]);
  const [status, setStatus] = useState(""), [page, setPage] = useState(1), [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState("");
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    void (async () => {
      try {
        const response = await fetch(`/api/admin/enquiries?page=${page}&status=${encodeURIComponent(status)}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to load enquiries.");
        if (!controller.signal.aborted) { setEnquiries(data.enquiries); setHasMore(data.hasMore); }
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Unable to load enquiries."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [page, status, reload]);
  async function update(id: string, nextStatus: EnquiryStatus) {
    setSaving(id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/enquiries", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: nextStatus }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to update enquiry.");
      setNotice("Enquiry status saved. The customer can see the updated status in their account.");
      setReload(value => value + 1);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update enquiry."); }
    finally { setSaving(""); }
  }
  return <section className="table-panel padded">
    <div className="catalogue-toolbar"><h2>Project conversations.</h2><label>Enquiry status<select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option>{enquiryStatuses.map(value => <option key={value}>{value}</option>)}</select></label><button className="button outline" disabled={loading || Boolean(saving)} onClick={() => setReload(value => value + 1)}>Refresh</button></div>
    <p>Submitted enquiries from customers and guests, saved in your website database.</p>
    {error && <p role="alert" className="form-error">{error}</p>}{notice && <p role="status">{notice}</p>}
    {loading ? <p role="status">Loading enquiries…</p> : <>
      <div className="saved-enquiries-list">{enquiries.map(enquiry => <article className="saved-enquiry" key={enquiry.id}>
        <div className="saved-enquiry-heading"><strong>{enquiry.name}</strong><time dateTime={enquiry.createdAt}>{new Date(enquiry.createdAt).toLocaleString("en-IN")}</time></div>
        <p>{enquiry.accountEmail ? `Website account: ${enquiry.accountEmail}` : "Guest enquiry"}</p>
        <EnquiryDetails enquiry={enquiry} admin />
        <label className="enquiry-status-control">Status<select aria-label={`Status for enquiry ${enquiry.id}`} value={enquiry.status} disabled={Boolean(saving)} onChange={e => void update(enquiry.id, e.target.value as EnquiryStatus)}>{enquiryStatuses.map(value => <option key={value}>{value}</option>)}</select></label>
      </article>)}</div>
      {!enquiries.length && <p>No enquiries match this filter.</p>}
      <nav className="enquiry-pagination" aria-label="Admin enquiry pages"><button className="button outline" disabled={page === 1 || Boolean(saving)} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page}</span><button className="button outline" disabled={!hasMore || Boolean(saving)} onClick={() => setPage(value => value + 1)}>Next</button></nav>
    </>}
  </section>;
}
