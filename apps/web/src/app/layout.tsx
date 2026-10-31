import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope, Marcellus } from "next/font/google";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { SmoothScroll } from "@/components/motion";
import { Toaster } from "@/components/toaster";
import { apiOrNull, type Me } from "@/lib/api";
import "./globals.css";

// Fraunces (variable, soft optical axes) for display; Manrope for UI; Marcellus echoes the classic roman capitals printed on the packs.
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", axes: ["SOFT", "WONK", "opsz"], style: ["normal", "italic"] });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
const marcellus = Marcellus({ subsets: ["latin"], variable: "--font-marcellus", display: "swap", weight: "400" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_ORIGIN ?? "http://localhost:3000"),
  title: { default: "Oryvia Care — Skincare & Hair Care", template: "%s · Oryvia Care" },
  description: "Oryvia skincare and hair care for everyday routines, with professional packages for salons and retailers.",
  robots: process.env.ALLOW_INDEXING === "true" ? undefined : { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#fbf6ee", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [me, cart, settings] = await Promise.all([
    apiOrNull<Me>("/v1/account/me"),
    apiOrNull<{ items: unknown[] }>("/v1/carts/current"),
    apiOrNull<{ contact: Record<string, string> | null; announcement: { text: string; href?: string } | null }>("/v1/content/settings/public"),
  ]);
  return (
    <html lang="en-IN" className={`${fraunces.variable} ${manrope.variable} ${marcellus.variable}`}>
      <body>
        <SmoothScroll />
        {settings?.announcement && (
          <div className="bg-night px-4 py-2 text-center text-sm text-on-night">{settings.announcement.text}</div>
        )}
        <Header cartCount={cart?.items.length ?? 0} signedIn={!!me} />
        <main id="main" className="min-h-[60vh]">
          {children}
        </main>
        <Footer contact={settings?.contact ?? null} />
        <Toaster />
      </body>
    </html>
  );
}
