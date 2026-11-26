import Link from "next/link";
import { PageIntro } from "@/components/ui";

export const metadata = {
  title: "Privacy policy",
  description: "How INOX handles website account details, product enquiries, cookies and your privacy requests.",
};

const sections = [
  { id: "information", title: "Information you share", content: <><p>When you create a website account, we collect your name, email address, country code, mobile number, optional company name and account consent. We store a password hash rather than your original password.</p><p>When you send an enquiry, we collect the contact and project details you provide, your message, selected products, variations and quantities. Enquiries sent while signed in are linked to your account so you can revisit them.</p></> },
  { id: "purpose", title: "How we use your information", content: <p>We use your details to create and secure your account, provide signed-in access to product prices, save your enquiries, respond to project requests and manage follow-up. Account records also help us maintain the website and investigate misuse.</p> },
  { id: "activity", title: "Account activity and access", content: <><p>We record website registration, successful sign-ins, sign-outs and enquiry submissions. Authorised website administrators can view customer contact details, account activity, valid session counts and enquiries to manage website services and customer requests.</p><p>Customers can access enquiries linked to their own account. Entering an email address into a guest enquiry does not automatically attach it to an account.</p></> },
  { id: "cookies", title: "Cookies and browser storage", content: <><p>We use an essential session cookie to keep you signed in. Customer sessions expire after seven days unless you sign out earlier. This cookie is HTTP-only, so website scripts cannot read it.</p><p>Your enquiry basket is stored in your browser so your selections remain on that device. Your browser may also remember preferences you choose to save. You can remove cookies and local storage through your browser settings; doing so may sign you out or clear your selections.</p></> },
  { id: "sharing", title: "Service providers and external links", content: <><p>Hosting and database services process information as part of operating this website. Information submitted in an enquiry is available to the team handling that request. Disclosure may also be necessary to meet applicable requirements or protect the service from misuse.</p><p>External websites linked from this site have their own privacy practices. Review their policies before sharing information with them.</p></> },
  { id: "retention", title: "Storage and security", content: <><p>Account and enquiry information is retained to provide account services, handle customer requests and meet applicable record-keeping needs. Browser-stored selections remain until you remove them or clear your browser storage.</p><p>We use password hashing, session checks and access controls to protect website account information. No online service can guarantee absolute security. Keep your password private and sign out when using a shared device.</p></> },
  { id: "choices", title: "Your choices and requests", content: <><p>You can sign out at any time and view your saved enquiries from My account. To ask about your information, request a correction, or request deletion of account or enquiry records, <Link className="text-link" href="/contact">contact the INOX team</Link>. We may need to verify your identity before acting on a request. Some records may need to be retained for applicable obligations.</p><p>Please do not include passwords or sensitive personal information in an enquiry.</p></> },
  { id: "updates", title: "About this policy", content: <p>This policy describes the INOX website account and enquiry services. We may update it as these services change. For questions about this policy or how website information is handled, please <Link className="text-link" href="/contact">get in touch</Link>.</p> },
];

export default function Privacy() {
  return <main id="main" className="wrap inner-page privacy-page">
    <PageIntro eyebrow="Privacy policy" title="Your privacy matters." description="A clear look at the information you share with INOX, why we use it and the choices available to you." />
    <div className="privacy-layout">
      <nav className="privacy-contents" aria-label="Privacy policy contents"><span className="eyebrow">In this policy</span>{sections.map((section, index) => <a href={`#${section.id}`} key={section.id}><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>{section.title}</a>)}</nav>
      <div className="privacy-body">{sections.map((section, index) => <section id={section.id} key={section.id} aria-labelledby={`${section.id}-title`}><span className="privacy-section-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><h2 id={`${section.id}-title`}>{section.title}</h2>{section.content}</section>)}</div>
    </div>
  </main>;
}
