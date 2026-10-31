import type { NextConfig } from "next";

// Monorepo: the single .env lives at the repo root. Only server-side values are read here.
try {
  process.loadEnvFile("../../.env");
} catch {
  /* optional in production, where real environment variables are set */
}

const api = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:4000";

const config: NextConfig = {
  transpilePackages: ["@oryvia/contracts"],
  poweredByHeader: false,
  // Single origin: the browser only ever talks to this host; /api and /media are proxied to the backend.
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${api}/api/:path*` },
      { source: "/media/:path*", destination: `${api}/media/:path*` },
    ];
  },
  // Legacy WordPress URLs → new routes (one-to-one, permanent). Generated from data/source/redirects.csv.
  async redirects() {
    const { default: rows } = await import("./src/lib/legacy-redirects.json", { with: { type: "json" } });
    return (rows as Array<{ source: string; destination: string }>).map((r) => ({ ...r, permanent: true }));
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      { source: "/(account|admin|partner|checkout|cart)(.*)", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
  images: { unoptimized: false, remotePatterns: [] },
};

export default config;
