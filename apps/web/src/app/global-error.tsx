"use client";
// Shown when the root layout itself fails, which is what happens while the API is asleep: the layout reads the session, cart and settings on every page.
import { ApiWakeGate } from "@/components/api-wake-gate";
import "./globals.css";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  const shell = (content: React.ReactNode) => (
    <div className="hero-light overflow-hidden">
      <div className="dot-grid" aria-hidden="true" />
      <div className="relative mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-5 py-20 text-center">{content}</div>
    </div>
  );
  return (
    <html lang="en-IN">
      <body>
        <ApiWakeGate shell={shell}>
          {shell(
            <>
              <p className="eyebrow mb-3">Something went wrong</p>
              <h1 className="font-display text-4xl tracking-[-0.02em] sm:text-5xl">This page did not load</h1>
              <p className="mt-4 text-lg text-muted">Please try again. If it keeps happening, contact us and mention the reference below.</p>
              <div className="mt-8 flex justify-center">
                <button className="btn btn-primary" onClick={() => window.location.reload()}>Try again</button>
              </div>
              {error.digest && <p className="tabular mt-6 text-xs text-muted">Reference: {error.digest}</p>}
            </>,
          )}
        </ApiWakeGate>
      </body>
    </html>
  );
}
