// Server-side API access. Forwards the browser's cookies so the API resolves identity itself.
// The web tier never decides permissions; it only renders what the API returns.
import "server-only";
import { cookies } from "next/headers";

const API = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4000";

export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown; revalidate?: number | false } = {}): Promise<T> {
  const jar = await cookies();
  const cookieHeader = jar
    .getAll()
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join("; ");
  const res = await fetch(`${API}/api${path}`, {
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
