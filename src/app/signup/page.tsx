import { CustomerForm } from "@/components/customer-account";
export const metadata = { title: "Create your INOX account", robots: { index: false, follow: false } };
export default function Signup() { return <CustomerForm signup />; }
