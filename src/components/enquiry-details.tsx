import type { SavedEnquiry } from "@/lib/customer-enquiry-model";

export function EnquiryDetails({ enquiry, admin = false }: { enquiry: SavedEnquiry; admin?: boolean }) {
  return <div className="saved-enquiry-details">
    <p><strong>{enquiry.type}</strong>{enquiry.city && <> · {enquiry.city}</>}</p>
    <p className="saved-enquiry-message">{enquiry.message}</p>
    {admin && <p>{enquiry.name}{enquiry.company && <> · {enquiry.company}</>}<br />{enquiry.email} · {enquiry.phone}</p>}
    {enquiry.items.length > 0 && <ul className="saved-enquiry-products">{enquiry.items.map((item, index) => <li key={`${item.id}:${item.variationId}:${index}`}><span>{item.name}<small>{item.sku}</small></span><strong>Qty {item.quantity}</strong></li>)}</ul>}
    <small>Reference: {enquiry.id}</small>
  </div>;
}
