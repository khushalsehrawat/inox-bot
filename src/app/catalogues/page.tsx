import { PageIntro } from "@/components/ui";
import { CatalogueDownloads } from "@/components/catalogue-downloads";
export const metadata = {
  title: "Catalogues",
  description:
    "Explore the INOX collection and download the supplied brand catalogue.",
};
export default function Catalogues() {
  return (
    <main id="main" className="wrap inner-page">
      <PageIntro
        eyebrow="The collection, considered"
        title="Ideas begin in the details."
        description="A closer look at the possibilities for your next project."
      />
      <CatalogueDownloads />
    </main>
  );
}
