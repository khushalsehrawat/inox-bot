import { PageIntro } from "@/components/ui";
import { EnquiryForm } from "@/components/enquiry-form";
export const metadata = {
  title: "Contact & Enquiries",
  description:
    "Start a conversation with INOX about your next interior project.",
};
export default function Contact() {
  return (
    <main id="main" className="wrap inner-page">
      <PageIntro
        eyebrow="A conversation starts here"
        title="Let’s create something considered."
        description="For product information, design support and project enquiries, tell us a little about what you have in mind."
      />
      <EnquiryForm />
      <div className="contact-note">
        <h3>Visit <mark className="inox-word">INOX</mark></h3>
        <p>
          Verified business address, contact number and opening hours are
          pending brand confirmation. No unverified WhatsApp or map links are
          published.
        </p>
      </div>
    </main>
  );
}
