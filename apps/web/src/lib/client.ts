"use client";
// Browser-side calls go to the same origin (/api is proxied), so session cookies flow automatically.

export interface ClientError {
  code: string;
  message: string;
  fields?: Record<string, string[]>;
}

export async function call<T>(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<{ ok: true; data: T } | { ok: false; error: ClientError; status: number }> {
  try {
    const res = await fetch(`/api${path}`, {
      method: init.method ?? "GET",
      headers: { ...(init.body !== undefined ? { "content-type": "application/json" } : {}), ...init.headers },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      credentials: "same-origin",
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, status: res.status, error: json?.error ?? { code: "unknown", message: json?.message ?? `Request failed (${res.status})` } };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, status: 0, error: { code: "network", message: "We could not reach the server. Check your connection and try again." } };
  }
}

export const newIdempotencyKey = () => `ck_${crypto.randomUUID().replace(/-/g, "")}`;

/** Notify header badges (cart count) that server cart state changed. */
export const cartChanged = (count: number) => window.dispatchEvent(new CustomEvent("oryvia:cart", { detail: { count } }));
