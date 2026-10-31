// Loading placeholders shaped like the content they stand in for. Decorative; the page announces itself when ready.
export function IntroSkeleton() {
  return (
    <div className="hero-light -mt-[84px] overflow-hidden pt-[84px]" aria-hidden="true">
      <div className="dot-grid" />
      <div className="mx-auto max-w-[1400px] px-5 pb-12 pt-12 sm:px-8 sm:pb-16 sm:pt-16">
        <div className="skel mb-5 h-3 w-24" />
        <div className="skel h-14 w-[min(520px,80%)] sm:h-20" />
        <div className="skel mt-5 h-4 w-[min(420px,70%)]" />
      </div>
    </div>
  );
}

export function GridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-ambient)]">
          <div className="skel aspect-[4/5] rounded-none" />
          <div className="space-y-2.5 p-5">
            <div className="skel h-4 w-4/5" />
            <div className="skel h-4 w-3/5" />
            <div className="flex justify-between pt-3">
              <div className="skel h-6 w-16" />
              <div className="skel h-6 w-16 rounded-full" />
            </div>
            <div className="skel mt-2 h-11 rounded-full" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ListingSkeleton() {
  return (
    <div role="status" aria-label="Loading products">
      <IntroSkeleton />
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
        <div className="skel mb-10 h-20 rounded-[28px]" />
        <GridSkeleton />
      </div>
    </div>
  );
}

export function ProductSkeleton() {
  return (
    <div role="status" aria-label="Loading product" className="mx-auto grid max-w-[1400px] gap-10 px-5 pt-6 sm:px-8 lg:grid-cols-[1.1fr_1fr]">
      <div className="space-y-3">
        <div className="skel aspect-square rounded-[28px]" />
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }, (_, i) => <div key={i} className="skel aspect-square rounded-2xl" />)}
        </div>
      </div>
      <div className="space-y-4 pt-4">
        <div className="skel h-3 w-24" />
        <div className="skel h-12 w-11/12" />
        <div className="skel h-12 w-3/4" />
        <div className="skel h-10 w-32" />
        <div className="skel h-24 w-full" />
        <div className="grid grid-cols-2 gap-2 pt-2">
          <div className="skel h-11 rounded-full" />
          <div className="skel h-11 rounded-full" />
        </div>
      </div>
    </div>
  );
}
