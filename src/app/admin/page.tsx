import "./admin-premium.css";
import { AdminWorkspace } from "@/components/admin-workspace";
export const metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};
export default function Admin() {
  return <AdminWorkspace />;
}
