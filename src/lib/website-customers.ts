import { cookies } from "next/headers";
import { customerCookie, sessionAccount } from "./website-account-auth";
export type Customer = { id: string; email: string; profile?: { firstName?: string; lastName?: string; mobile?: string; countryCode?: string; companyName?: string } };
export async function customerSession(): Promise<Customer | null> {
  return sessionAccount((await cookies()).get(customerCookie)?.value);
}
