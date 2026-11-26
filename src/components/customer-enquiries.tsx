"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useCustomer } from "./customer-account";
import { EnquiryDetails } from "./enquiry-details";
import type { SavedEnquiry } from "@/lib/customer-enquiry-model";

export function CustomerEnquiries() {
  const { user, refresh } = useCustomer();
  const [enquiries, setEnquiries] = useState<SavedEnquiry[]>([]);
  const [page, setPage] = useState(1), [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    setLoading(true); setError(""); setEnquiries([]);
    void (async () => {
      try {
        const response = await fetch(`/api/customer/enquiries?page=${page}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (response.status === 401) { await refresh(); throw new Error("Please sign in again to see your saved enquiries."); }
        if (!response.ok) throw new Error(data.message || "Unable to load enquiries.");
        if (!controller.signal.aborted) { setEnquiries(data.enquiries); setHasMore(data.hasMore); }
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Unable to load enquiries."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [user?.id, page, reload]);
  return <section className="customer-enquiries" aria-labelledby="saved-enquiries-title">
    <div className="saved-enquiries-heading"><div><span className="eyebrow">Your projects, in one place</span><h2 id="saved-enquiries-title">Saved enquiries.</h2><p>Revisit your submitted selections and follow their progress.</p></div><button className="button outline" disabled={loading} onClick={() => setReload(value => value + 1)}>Refresh</button></div>
    {error ? <p role="alert" className="form-error">{error}</p> : loading ? <p role="status">Loading your enquiries…</p> : enquiries.length ? <div className="saved-enquiries-list">{enquiries.map(enquiry => <article className="saved-enquiry" key={enquiry.id}><div className="saved-enquiry-heading"><time dateTime={enquiry.createdAt}>{new Date(enquiry.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</time><span className="status-tag">{enquiry.status}</span></div><EnquiryDetails enquiry={enquiry} /></article>)}</div> : <p>You have no saved enquiries yet. <Link className="text-link" href="/enquiry">Start an enquiry</Link></p>}
    {!error && !loading && <nav className="enquiry-pagination" aria-label="Enquiry pages"><button className="button outline" disabled={page === 1} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page}</span><button className="button outline" disabled={!hasMore} onClick={() => setPage(value => value + 1)}>Next</button></nav>}
  </section>;
}
