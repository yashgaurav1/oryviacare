// URL normalization and classification for the source crawl.

const TRACKING_PARAMS = /^(utm_.*|fbclid|gclid|mc_cid|mc_eid|_ga|ref|srsltid)$/i;

export type PageType =
  | "home"
  | "shop"
  | "product"
  | "product_category"
  | "post"
  | "post_category"
  | "page"
  | "news_index"
  | "sitemap"
  | "robots"
  | "api"
  | "excluded";

export interface Classified {
  url: string;
  type: PageType;
  excludedReason?: string;
}

const EXCLUDED_PATHS: Array<[RegExp, string]> = [
  [/^\/wp-admin\b/, "admin area"],
  [/^\/wp-login\.php/, "login endpoint"],
  [/^\/xmlrpc\.php/, "xmlrpc endpoint"],
  [/^\/cart\/?$/, "transactional route (cart); structure noted, not crawled"],
  [/^\/checkout\/?/, "transactional route (checkout)"],
  [/^\/my-account(-2)?\/?/, "account route"],
  [/^\/(login|registration|lost-password)\/?$/, "auth route"],
  [/^\/author\//, "author archive (personal data minimisation)"],
  [/\/feed\/?$/, "feed duplicate"],
  [/^\/wp-content\/uploads\/(wc-logs|woocommerce_transient_files|woocommerce_uploads)\//, "robots disallow"],
  [/^\/wp-(json|includes|content)\//, "non-page resource"],
  [/^\/comments\//, "comments feed"],
];

export function normalizeUrl(raw: string, base?: string): string | null {
  let u: URL;
  try {
    u = new URL(raw, base);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  u.protocol = "https:";
  u.hash = "";
  if (u.hostname === "www.oryviacare.in") u.hostname = "oryviacare.in";
  for (const k of [...u.searchParams.keys()]) if (TRACKING_PARAMS.test(k)) u.searchParams.delete(k);
  u.searchParams.sort();
  return u.toString();
}

export function classify(url: string): Classified {
  const u = new URL(url);
  if (u.hostname !== "oryviacare.in") return { url, type: "excluded", excludedReason: "off-domain" };
  const p = u.pathname;
  const q = u.searchParams;
  if ([...q.keys()].some((k) => /add-to-cart|remove_item|undo_item|logout|_wpnonce|action/i.test(k)))
    return { url, type: "excluded", excludedReason: "mutation/action URL" };
  if ([...q.keys()].some((k) => /^(filter_|min_price|max_price|orderby|rating_filter|query_type_)/.test(k)))
    return { url, type: "excluded", excludedReason: "faceted duplicate (robots/crawl-trap)" };
  if (q.has("replytocom") || q.has("s") || q.has("p") || q.has("page_id"))
    return { url, type: "excluded", excludedReason: "query duplicate" };
  if (q.has("wishlist") || q.has("compare") || [...q.keys()].some((k) => /wishlist|compare/i.test(k)))
    return { url, type: "excluded", excludedReason: "wishlist/compare action" };
  for (const [re, reason] of EXCLUDED_PATHS) if (re.test(p)) return { url, type: "excluded", excludedReason: reason };
  if (p === "/robots.txt") return { url, type: "robots" };
  if (/\.xml$/.test(p)) return { url, type: "sitemap" };
  if (/\.(png|jpe?g|webp|gif|svg|avif|mp4|webm|pdf|css|js|woff2?|ico)$/i.test(p))
    return { url, type: "excluded", excludedReason: "asset (handled by media manifest)" };
  if (p === "/" ) return { url, type: q.size ? "excluded" : "home", excludedReason: q.size ? "query on home" : undefined };
  if (/^\/shop\/?$/.test(p) || /^\/shop\/page\/\d+\/?$/.test(p)) return { url, type: "shop" };
  if (/^\/product\/[^/]+\/?$/.test(p)) return { url, type: "product" };
  if (/^\/product-category\//.test(p)) return { url, type: "product_category" };
  if (/^\/category\//.test(p)) return { url, type: "post_category" };
  if (/^\/news\/?/.test(p)) return { url, type: "news_index" };
  if (/^\/[^/]+\/?$/.test(p)) return { url, type: "page" };
  return { url, type: "page" };
}
