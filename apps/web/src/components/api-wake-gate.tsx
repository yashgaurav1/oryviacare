"use client";
// On Render's free plan the API sleeps when idle, and requests from the website's server do not wake it; only a request from outside Render does.
// So when a page fails while the API is down, the visitor's browser wakes it and reloads the page. Any other failure shows the normal error.
import { useEffect, useState } from "react";

const WAKE_URL = process.env.NEXT_PUBLIC_API_URL;
const GIVE_UP_MS = 180_000;
const POLL_MS = 3_000;
const WAKE_EVERY_MS = 15_000;

const healthy = () =>
  fetch("/api/health/live", { cache: "no-store", signal: AbortSignal.timeout(10_000) })
    .then((r) => r.ok)
    .catch(() => false);

export function ApiWakeGate({ children, shell }: { children: React.ReactNode; shell: (content: React.ReactNode) => React.ReactNode }) {
  const [state, setState] = useState<"checking" | "waking" | "failed">("checking");

  useEffect(() => {
    let stopped = false;
    (async () => {
      if (await healthy()) return !stopped && setState("failed");
      if (stopped) return;
      setState("waking");
      const started = Date.now();
      let lastWake = 0;
      while (!stopped && Date.now() - started < GIVE_UP_MS) {
        if (WAKE_URL && Date.now() - lastWake >= WAKE_EVERY_MS) {
          lastWake = Date.now();
          // Opaque by design: this only has to arrive. Readiness is read from the same-origin check.
          void fetch(`${WAKE_URL}/api/health/live`, { mode: "no-cors", cache: "no-store" }).catch(() => undefined);
        }
        await new Promise((r) => setTimeout(r, POLL_MS));
        if (!stopped && (await healthy())) return window.location.reload();
      }
      if (!stopped) setState("failed");
    })();
    return () => {
      stopped = true;
    };
  }, []);

  if (state === "failed") return <>{children}</>;
  return shell(
    <div role="status" aria-live="polite">
      <p className="eyebrow mb-3">One moment</p>
      <h1 className="font-display text-4xl tracking-[-0.02em] sm:text-5xl">Opening the store</h1>
      <p className="mt-4 text-lg text-muted">{state === "waking" ? "This can take about a minute after a quiet spell. The page will open by itself." : "Checking the connection."}</p>
    </div>,
  );
}
