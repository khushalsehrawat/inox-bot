type Enquiry = {
  name: string; email: string; phone: string; company: string;
  city: string; type: string; message: string;
  items: { name: string; sku: string; quantity: number }[];
};
export function notifySavedEnquiry(id: string, enquiry: Enquiry): Promise<'not-configured' | 'accepted' | 'failed'>;
