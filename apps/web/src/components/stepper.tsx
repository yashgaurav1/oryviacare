// Purchase progress: Cart → Details → Review → Placed. Purely visual; each page passes its own step.
const STEPS = ["Cart", "Details", "Review", "Placed"];

export function Stepper({ current }: { current: 0 | 1 | 2 | 3 }) {
  return (
    <nav aria-label="Checkout progress" className="mb-8">
      <ol className="relative flex justify-between">
        <span aria-hidden="true" className="absolute left-[12%] right-[12%] top-4 h-px bg-divider" />
        <span aria-hidden="true" className="stepper-fill absolute left-[12%] right-[12%] top-4 h-px bg-gradient-to-r from-kesar to-copper" style={{ transform: `scaleX(${current / (STEPS.length - 1)})` }} />
        {STEPS.map((s, i) => (
          <li key={s} className="relative z-10 flex w-1/4 flex-col items-center gap-2 text-center" aria-current={i === current ? "step" : undefined}>
            <span
              className={`grid size-8 place-items-center rounded-full text-xs font-bold transition-all duration-500 ${
                i < current ? "bg-ink text-kesar-light" : i === current ? "bg-kesar text-ink shadow-[0_0_0_6px_rgb(214_161_63/0.2)]" : "bg-surface text-muted ring-1 ring-divider"
              }`}
            >
              {i < current ? "✓" : i + 1}
            </span>
            <span className={`text-xs font-semibold uppercase tracking-[0.14em] ${i === current ? "text-ink" : "text-muted"}`}>{s}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
