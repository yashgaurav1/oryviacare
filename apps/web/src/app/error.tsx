"use client";
// Shown when a page fails to render. No technical detail is shown to customers; the digest helps support find the log line.
import Link from "next/link";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="hero-light -mt-[84px] overflow-hidden pt-[84px]">
      <div className="dot-grid" aria-hidden="true" />
      <div className="relative mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-5 py-20 text-center">
        <p className="eyebrow mb-3">Something went wrong</p>
        <h1 className="font-display text-4xl tracking-[-0.02em] sm:text-5xl">This page did not load</h1>
        <p className="mt-4 text-lg text-muted">Please try again. If it keeps happening, contact us and mention the reference below.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button className="btn btn-primary" onClick={reset}>Try again</button>
          <Link href="/" className="btn btn-secondary">Go home</Link>
        </div>
        {error.digest && <p className="tabular mt-6 text-xs text-muted">Reference: {error.digest}</p>}
      </div>
    </div>
  );
}
