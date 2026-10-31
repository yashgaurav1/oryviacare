import Link from "next/link";
import { Kinetic } from "@/components/kinetic";

export default function NotFound() {
  return (
    <div className="hero-light -mt-[84px] overflow-hidden pt-[84px]">
      <div className="mesh" aria-hidden="true">
        <span className="left-[40%] top-[-10%] h-[26rem] w-[26rem] bg-[#f3d49a]" />
        <span className="left-[-10%] top-[30%] h-[22rem] w-[22rem] bg-[#f4cdc2]" style={{ animationDelay: "-8s" }} />
      </div>
      <div className="dot-grid" aria-hidden="true" />
      <div className="relative mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-5 py-20 text-center">
        <p className="tabular font-display text-[clamp(6rem,22vw,12rem)] leading-none tracking-[-0.05em] text-gold-deep" aria-hidden="true">404</p>
        <h1 className="mt-2 font-display text-4xl tracking-[-0.02em] sm:text-5xl">
          <Kinetic text="We could not find that page" className="mask-words" />
        </h1>
        <p className="rise mt-4 max-w-md text-lg text-muted" style={{ animationDelay: "250ms" }}>It may have moved when the store was rebuilt. These might help:</p>
        <div className="rise mt-8 flex flex-wrap justify-center gap-3" style={{ animationDelay: "350ms" }}>
          <Link href="/shop" className="btn btn-primary">Shop products</Link>
          <Link href="/search" className="btn btn-secondary">Search</Link>
          <Link href="/contact" className="btn btn-ghost">Contact us</Link>
        </div>
      </div>
    </div>
  );
}
