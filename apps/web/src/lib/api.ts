// Server-side API access. Forwards the browser's cookies so the API resolves identity itself.
// The web tier never decides permissions; it only renders what the API returns.
import "server-only";
import { cookies } from "next/headers";

const API = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4000";

// On Render's free plan the API sleeps when idle and takes about a minute to wake, so reads wait for it instead of failing the page.
const WAKE_WAIT_MS = process.env.NODE_ENV === "production" ? 120_000 : 0;
const WAKE_RETRY_MS = 2_000;
const WAKE_ATTEMPT_MS = 60_000;

export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Writes are never repeated, because the first attempt may have reached the API.
 * A JSON error came from the API itself, so it is a real answer; only the host's own 502/503/504 means "still waking".
 */
async function fetchWaking(url: string, init: RequestInit): Promise<Response> {
  if (init.method !== "GET") return fetch(url, init);
  const deadline = Date.now() + WAKE_WAIT_MS;
  // React memoizes identical GETs for the whole render, so a retry needs a signal to reach the network again.
  for (let attempt = init; ; attempt = { ...init, signal: AbortSignal.timeout(WAKE_ATTEMPT_MS) }) {
    try {
      const res = await fetch(url, attempt);
      const waking = [502, 503, 504].includes(res.status) && !res.headers.get("content-type")?.includes("json");
      if (!waking || Date.now() >= deadline) return res;
      // Not awaited: on a memoized response this is a stream copy, and its cancel never settles.
      void res.body?.cancel().catch(() => undefined);
    } catch (e) {
      if (Date.now() >= deadline) throw e;
    }
    await new Promise((r) => setTimeout(r, WAKE_RETRY_MS));
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown; revalidate?: number | false } = {}): Promise<T> {
  const jar = await cookies();
  const cookieHeader = jar
    .getAll()
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join("; ");
  const res = await fetchWaking(`${API}/api${path}`, {
    method: init.method ?? "GET",
    headers: { ...(cookieHeader ? { cookie: cookieHeader } : {}), ...(init.body ? { "content-type": "application/json" } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
    // Private or per-user data is never cached; public catalogue reads are always fresh so price/stock stay correct.
    cache: "no-store",
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: { code: string; message: string } } | null;
    throw new ApiFailure(res.status, err?.error?.code ?? "unknown", err?.error?.message ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function apiOrNull<T>(path: string): Promise<T | null> {
  try {
    return await api<T>(path);
  } catch (e) {
    if (e instanceof ApiFailure && (e.status === 404 || e.status === 401 || e.status === 403)) return null;
    throw e;
  }
}

export interface ProductCard {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  variantId: string | null;
  packSize: string | null;
  pricePaise: number | null;
  referencePaise: number | null;
  referenceLabel: string | null;
  availability: "in_stock" | "out_of_stock" | "not_for_sale";
  availableQuantity: number;
  images: Array<{ src: string; alt: string; width: number | null; height: number | null }>;
  categories: Array<{ slug: string; name: string }>;
  featuredIngredients: Array<{ slug: string; name: string }>;
}

export interface Me {
  userId: string;
  name: string;
  email: string;
  emailVerified: boolean;
  isStaff: boolean;
  permissions: string[];
  twoFactorEnabled: boolean;
  memberships: Array<{ accountId: string; role: string; accountStatus: string }>;
}
