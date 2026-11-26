import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="wrap inner-page empty-state">
      <span className="eyebrow">404</span>
      <h1>A detail we couldn’t find.</h1>
      <p>This page may have moved.</p>
      <Link className="button outline" href="/products">
        Explore products
      </Link>
    </main>
  );
}
