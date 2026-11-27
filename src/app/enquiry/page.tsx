import { mainSiteConnected } from "@/lib/main-site-catalogue";
import { getWebProducts } from "@/lib/web-taxonomy";
import { PageIntro } from "@/components/ui";
import { EnquiryForm } from "@/components/enquiry-form";
export const metadata = {
  title: "Your Enquiry",
  robots: { index: false, follow: false },
};
export default async function Enquiry() {
  return (
    <main className="wrap inner-page" id="main">
      <PageIntro
        eyebrow="Thoughtfully selected"
        title="Your project, coming together."
        description="Review your products and quantities, then share your project details."
      />
      <EnquiryForm basket mainSite={mainSiteConnected()} products={await getWebProducts()} />
    </main>
  );
}
