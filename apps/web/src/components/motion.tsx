"use client";
// Small motion primitives. All of them do nothing under prefers-reduced-motion and keep content visible without JS.
import { useEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Fades/rises its children in the first time they scroll into view. `delay` staggers siblings. */
export function Reveal({ children, as: Tag = "div", delay = 0, className = "", ...rest }: { children: ReactNode; as?: ElementType; delay?: number; className?: string; id?: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced() || !("IntersectionObserver" in window)) {
      el.dataset.shown = "true";
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            el.dataset.shown = "true";
            io.disconnect();
          }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={`reveal ${className}`} style={{ "--d": `${delay}ms` } as CSSProperties} {...rest}>
      {children}
    </Tag>
  );
}

/** 3D tilt toward the pointer plus a cursor-following light (`.sheen` child). Fine pointers only. */
export function Tilt({ children, className = "", max = 7 }: { children: ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced() || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let frame = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        el.style.setProperty("--ry", `${(x - 0.5) * max * 2}deg`);
        el.style.setProperty("--rx", `${(0.5 - y) * max * 2}deg`);
        el.style.setProperty("--mx", `${x * 100}%`);
        el.style.setProperty("--my", `${y * 100}%`);
        el.dataset.active = "true";
      });
    };
    const leave = () => {
      cancelAnimationFrame(frame);
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
      el.dataset.active = "false";
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [max]);
  return (
    <div ref={ref} className={`tilt ${className}`}>
      {children}
    </div>
  );
}

/** Pulls its child slightly toward the pointer (used on hero calls to action). */
export function Magnetic({ children, strength = 0.28 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced() || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * strength}px, ${(e.clientY - r.top - r.height / 2) * strength}px)`;
    };
    const leave = () => (el.style.transform = "");
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [strength]);
  return (
    <span ref={ref} className="inline-block transition-transform duration-300 ease-out will-change-transform">
      {children}
    </span>
  );
}

/** Hero pointer parallax: children with data-depth move against the cursor, layered. */
export function Parallax({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced() || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const layers = Array.from(el.querySelectorAll<HTMLElement>("[data-depth]"));
    let frame = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const x = e.clientX / window.innerWidth - 0.5;
        const y = e.clientY / window.innerHeight - 0.5;
        for (const l of layers) {
          const d = Number(l.dataset.depth);
          l.style.translate = `${-x * d}px ${-y * d}px`;
        }
      });
    };
    window.addEventListener("pointermove", move);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
    };
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/**
 * Drifting gold dust (echoes the gold-dust artwork on the Oryvia packs). Canvas 2D, ~70 particles,
 * paused when off-screen or the tab is hidden; not rendered at all under reduced motion.
 */
export function GoldDust({ className = "", density = 70, tone = "night" }: { className?: string; density?: number; tone?: "night" | "light" }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || reduced()) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const count = Math.round(density * Math.min(1, w / 1200 + 0.35));
    const ps = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.8 + 0.4,
      vy: -(Math.random() * 0.25 + 0.06),
      vx: (Math.random() - 0.5) * 0.12,
      tw: Math.random() * Math.PI * 2,
      hue: Math.random() < 0.8 ? 42 : 22,
    }));
    let raf = 0;
    let visible = true;
    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of ps) {
        p.x += p.vx;
        p.y += p.vy;
        p.tw += 0.03;
        if (p.y < -10) {
          p.y = h + 10;
          p.x = Math.random() * w;
        }
        const a = 0.35 + Math.sin(p.tw) * 0.3;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
        const light = tone === "light" ? 48 : 70;
        g.addColorStop(0, `hsla(${p.hue}, 80%, ${light}%, ${tone === "light" ? a * 0.75 : a}`);
        g.addColorStop(1, `hsla(${p.hue}, 80%, ${light - 10}%, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      if (visible) raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting && document.visibilityState === "visible";
      cancelAnimationFrame(raf);
      if (visible) raf = requestAnimationFrame(tick);
    });
    io.observe(canvas);
    const onVis = () => {
      visible = document.visibilityState === "visible";
      cancelAnimationFrame(raf);
      if (visible) raf = requestAnimationFrame(tick);
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("resize", resize);
    };
  }, [density, tone]);
  return <canvas ref={ref} aria-hidden="true" className={`pointer-events-none ${className}`} />;
}

/**
 * Inertial smooth scrolling (Lenis) plus a 0–1 `--scroll` variable on <html> for the progress line.
 * Skipped entirely under reduced motion; native scrolling and keyboard navigation keep working either way.
 */
export function SmoothScroll() {
  useEffect(() => {
    const root = document.documentElement;
    const setProgress = () => {
      const max = root.scrollHeight - window.innerHeight;
      root.style.setProperty("--scroll", String(max > 0 ? window.scrollY / max : 0));
    };
    setProgress();
    window.addEventListener("scroll", setProgress, { passive: true });
    let alive = true;
    let raf = 0;
    let lenis: { raf: (t: number) => void; destroy: () => void } | null = null;
    if (!reduced())
      import("lenis").then(({ default: Lenis }) => {
        if (!alive) return;
        lenis = new Lenis({ lerp: 0.09, smoothWheel: true, anchors: true });
        const loop = (t: number) => {
          lenis?.raf(t);
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      lenis?.destroy();
      window.removeEventListener("scroll", setProgress);
    };
  }, []);
  return <div aria-hidden="true" className="scroll-progress" />;
}

/** Writes how far the element has scrolled past the top of the viewport (0–1) to `--p` on itself. */
export function ScrollVar({ children, className = "", as: Tag = "section" }: { children: ReactNode; className?: string; as?: ElementType }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced()) return;
    let frame = 0;
    const on = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height)));
        el.style.setProperty("--p", p.toFixed(4));
      });
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", on);
    };
  }, []);
  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}

/**
 * Pinned horizontal gallery: on wide screens the section sticks while vertical scrolling moves the track sideways.
 * On narrow screens, touch devices or reduced motion it is a plain swipeable scroll-snap row.
 */
export function HorizontalPin({ children, header }: { children: ReactNode; header: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const o = outer.current;
    const t = track.current;
    if (!o || !t) return;
    const mq = window.matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine)");
    let frame = 0;
    let distance = 0;
    const layout = () => {
      if (!mq.matches || reduced()) {
        o.dataset.pinned = "false";
        o.style.height = "";
        t.style.transform = "";
        return;
      }
      o.dataset.pinned = "true";
      distance = Math.max(0, t.scrollWidth - t.clientWidth);
      o.style.height = `${window.innerHeight + distance}px`;
      onScroll();
    };
    const onScroll = () => {
      if (o.dataset.pinned !== "true") return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = o.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - window.innerHeight)));
        t.style.transform = `translate3d(${-p * distance}px,0,0)`;
        o.style.setProperty("--p", p.toFixed(4));
      });
    };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(t);
    window.addEventListener("resize", layout);
    window.addEventListener("scroll", onScroll, { passive: true });
    mq.addEventListener("change", layout);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener("resize", layout);
      window.removeEventListener("scroll", onScroll);
      mq.removeEventListener("change", layout);
    };
  }, []);
  return (
    <div ref={outer} className="hpin relative" data-pinned="false">
      <div className="hpin-sticky">
        {header}
        <div ref={track} className="hpin-track">
          {children}
        </div>
        <div aria-hidden="true" className="hpin-bar mx-auto mt-8 h-px max-w-[1400px] bg-divider">
          <span className="block h-full origin-left bg-ink" />
        </div>
      </div>
    </div>
  );
}

/** Counts up to `value` the first time it scrolls into view. Renders the final number without JS. */
export function CountUp({ value, className = "" }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced()) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const dur = 1400;
      const step = (now: number) => {
        const k = Math.min(1, (now - start) / dur);
        el.textContent = String(Math.round(value * (1 - Math.pow(1 - k, 4))));
        if (k < 1) requestAnimationFrame(step);
      };
      el.textContent = "0";
      requestAnimationFrame(step);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [value]);
  return (
    <span ref={ref} className={`tabular ${className}`}>
      {value}
    </span>
  );
}

/** One listener for a grid: each `.spot` child gets --sx/--sy for a border glow that follows the cursor. */
export function Spotlight({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced() || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const cards = () => Array.from(el.querySelectorAll<HTMLElement>(".spot"));
    const move = (e: PointerEvent) => {
      for (const c of cards()) {
        const r = c.getBoundingClientRect();
        c.style.setProperty("--sx", `${e.clientX - r.left}px`);
        c.style.setProperty("--sy", `${e.clientY - r.top}px`);
      }
    };
    el.addEventListener("pointermove", move);
    return () => el.removeEventListener("pointermove", move);
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
