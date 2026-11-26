import Image from "next/image";

export function BrandLogo({ priority = false }: { priority?: boolean }) {
  return (
    <Image
      className="brand-logo"
      src="/media/editorial/logo.png"
      alt="INOX — Part of Home. Worldwide."
      width={922}
      height={1015}
      sizes="(max-width: 760px) 52px, 86px"
      priority={priority}
    />
  );
}
