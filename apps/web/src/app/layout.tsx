import type { Metadata, Viewport } from "next";
import { Jost, Playfair_Display } from "next/font/google";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { apiOrNull, type Me } from "@/lib/api";
import "./globals.css";

const jost = Jost({ subsets: ["latin"], variable: "--font-jost", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap", weight: ["500", "600"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_ORIGIN ?? "http://localhost:3000"),
  title: { default: "Oryvia Care — Skincare & Hair Care", template: "%s · Oryvia Care" },
  description: "Oryvia skincare and hair care for everyday routines, with professional packages for salons and retailers.",
  robots: process.env.ALLOW_INDEXING === "true" ? undefined : { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#f7f4ec", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [me, cart, settings] = await Promise.all([
    apiOrNull<Me>("/v1/account/me"),
    apiOrNull<{ items: unknown[] }>("/v1/carts/current"),
    apiOrNull<{ contact: Record<string, string> | null; announcement: { text: string; href?: string } | null }>("/v1/content/settings/public"),
  ]);
  return (
    <html lang="en-IN" className={`${jost.variable} ${playfair.variable}`}>
      <body>
        {settings?.announcement && (
          <div className="bg-primary px-4 py-2 text-center text-sm text-white">{settings.announcement.text}</div>
        )}
        <Header cartCount={cart?.items.length ?? 0} signedIn={!!me} />
        <main id="main" className="min-h-[60vh]">
          {children}
        </main>
        <Footer contact={settings?.contact ?? null} />
      </body>
    </html>
  );
}
