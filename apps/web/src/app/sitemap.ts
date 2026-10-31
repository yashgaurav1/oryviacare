import type { MetadataRoute } from "next";

const API = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4000";
const ORIGIN = process.env.PUBLIC_ORIGIN ?? "http://localhost:3000";

async function get<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${API}/api${path}`, { cache: "no-store" });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Only published, public URLs. Account, admin, partner, cart and checkout are never listed. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, articles, ingredients] = await Promise.all([
    get<{ items: Array<{ slug: string }> }>("/v1/catalog/products?pageSize=100"),
    get<Array<{ slug: string }>>("/v1/catalog/categories"),
    get<Array<{ slug: string }>>("/v1/content/articles"),
    get<Array<{ slug: string }>>("/v1/catalog/ingredients"),
  ]);
  const paths = [
    "/", "/shop", "/packages", "/business", "/ingredients", "/journal", "/about", "/contact", "/faq",
    ...(products?.items ?? []).map((p) => `/products/${p.slug}`),
    ...(categories ?? []).map((c) => `/category/${c.slug}`),
    ...(articles ?? []).map((a) => `/journal/${a.slug}`),
    ...(ingredients ?? []).map((i) => `/ingredients/${i.slug}`),
  ];
  return paths.map((p) => ({ url: `${ORIGIN}${p}` }));
}
