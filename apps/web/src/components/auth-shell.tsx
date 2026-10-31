import Image from "next/image";
import type { ReactNode } from "react";
import { apiOrNull, type ProductCard } from "@/lib/api";
import { Kinetic } from "./kinetic";

/** Split layout for sign-in pages: the form on one side, a light brand panel with floating product photos on the other. */
export async function AuthShell({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  const products = await apiOrNull<{ items: ProductCard[] }>("/v1/catalog/products?sort=featured&pageSize=6");
  const imgs = (products?.items ?? []).filter((p) => p.images[0]).slice(0, 3);
  return (
    <div className="mx-auto grid max-w-[1400px] items-center gap-10 px-5 py-12 sm:px-8 lg:min-h-[80vh] lg:grid-cols-2">
      <div className="mx-auto w-full max-w-md">
        <h1 className="mb-2 font-display text-5xl tracking-[-0.03em]">
          <Kinetic text={title} className="mask-words" />
        </h1>
        <p className="rise mb-8 text-muted" style={{ animationDelay: "200ms" }}>{intro}</p>
        <div className="rise rounded-[28px] bg-surface p-6 shadow-[var(--shadow-lift)] ring-1 ring-divider sm:p-8" style={{ animationDelay: "300ms" }}>
          {children}
        </div>
      </div>
      <div className="hero-light relative hidden h-[640px] overflow-hidden rounded-[40px] lg:block" aria-hidden="true">
        <div className="mesh">
          <span className="left-[30%] top-[-10%] h-[26rem] w-[26rem] bg-[#f3d49a]" />
          <span className="left-[-10%] top-[40%] h-[22rem] w-[22rem] bg-[#f4cdc2]" style={{ animationDelay: "-8s" }} />
          <span className="right-[-10%] bottom-[-10%] h-[22rem] w-[22rem] bg-[#cfe0cc]" style={{ animationDelay: "-14s" }} />
        </div>
        <div className="dot-grid" />
        {imgs.map((p, i) => (
          <div
            key={p.id}
            className="float-slow absolute w-[42%] overflow-hidden rounded-[28px] bg-surface p-2 shadow-[0_40px_80px_-30px_rgb(26_20_17/0.45)]"
            style={{ left: `${[30, 6, 52][i]}%`, top: `${[12, 42, 48][i]}%`, zIndex: i === 0 ? 2 : 1, ["--r" as string]: `${[-3, -9, 8][i]}deg`, animationDelay: `${i * -2.4}s` }}
          >
            <span className="relative block aspect-square overflow-hidden rounded-[22px]">
              <Image src={p.images[0].src} alt="" fill sizes="20vw" className="object-cover" />
            </span>
          </div>
        ))}
        <p className="absolute bottom-8 left-8 font-[family-name:var(--font-mark)] text-xl tracking-[0.32em]">ORYVIA</p>
      </div>
    </div>
  );
}
