import { CustomerForm } from "@/components/customer-account";
export const metadata = { title: "My INOX account", robots: { index: false, follow: false } };
export default function Account() { return <CustomerForm />; }
