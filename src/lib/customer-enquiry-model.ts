export const enquiryStatuses = ["New", "Contacted", "Quoted", "Closed"] as const;
export type EnquiryStatus = typeof enquiryStatuses[number];
export type SavedEnquiryItem = { id: string; variationId: string; quantity: number; name: string; sku: string };
export type SavedEnquiry = {
  id: string;
  customerId: string | null;
  status: EnquiryStatus;
  createdAt: string;
  updatedAt: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  city: string;
  type: string;
  message: string;
  items: SavedEnquiryItem[];
};
export type CustomerActivity = { id: string; customerId: string; email: string; event: string; createdAt: string; enquiryId?: string };
