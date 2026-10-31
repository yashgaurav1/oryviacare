import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-5 py-24 text-center">
      <p className="eyebrow mb-3">404</p>
      <h1 className="mb-4 font-display text-4xl">We could not find that page</h1>
      <p className="mb-8 text-muted">It may have moved when the store was rebuilt.</p>
      <div className="flex justify-center gap-3">
        <Link href="/shop" className="btn btn-primary">Shop products</Link>
        <Link href="/contact" className="btn btn-secondary">Contact us</Link>
      </div>
    </div>
  );
}
