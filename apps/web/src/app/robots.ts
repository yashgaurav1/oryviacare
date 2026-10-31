import type { MetadataRoute } from "next";

/** Staging and development are not indexable unless ALLOW_INDEXING=true is set for production. */
export default function robots(): MetadataRoute.Robots {
  const origin = process.env.PUBLIC_ORIGIN ?? "http://localhost:3000";
  if (process.env.ALLOW_INDEXING !== "true") return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/account", "/admin", "/partner", "/cart", "/checkout", "/api", "/track-order", "/search"] }],
    sitemap: `${origin}/sitemap.xml`,
  };
}
