import Link from "next/link";
import { api, type ProductCard as Card } from "@/lib/api";
import { Kinetic } from "./kinetic";
import { Reveal } from "./motion";
import { ProductCard } from "./product-card";

interface Search {
  q?: string;
  sort?: string;
  inStock?: string;
  page?: string;
  ingredient?: string;
}

const SORTS = [
  ["featured", "Featured"],
  ["price_asc", "Price: low to high"],
  ["price_desc", "Price: high to low"],
  ["name_asc", "Name: A–Z"],
  ["newest", "Newest"],
] as const;

/** Server-rendered listing. Filters are a plain GET form, so state lives in the URL and works without JavaScript. */
export async function CatalogListing({ basePath, category, search }: { basePath: string; category?: string; search: Search }) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (search.q) params.set("q", search.q);
  if (search.ingredient) params.set("ingredient", search.ingredient);
  params.set("sort", search.sort ?? "featured");
  if (search.inStock === "1") params.set("inStock", "1");
  params.set("page", search.page ?? "1");
  params.set("pageSize", "12");
  let data: { items: Card[]; total: number; page: number; pageSize: number } | null = null;
  let failed = false;
  try {
    data = await api(`/v1/catalog/products?${params}`);
  } catch {
    failed = true;
  }
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const pageHref = (p: number) => {
    const u = new URLSearchParams(Object.entries(search).filter(([, v]) => v) as [string, string][]);
    u.set("page", String(p));
    return `${basePath}?${u}`;
  };
  const hasFilters = !!(search.q || search.inStock || search.ingredient || (search.sort && search.sort !== "featured"));

  return (
    <div>
      <form method="get" action={basePath} className="glass mb-10 grid gap-3 rounded-[28px] p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end sm:p-5">
        <div>
          <label htmlFor="f-q" className="label">Search</label>
          <input id="f-q" name="q" defaultValue={search.q} className="input" placeholder="Product name or keyword" />
        </div>
        <div>
          <label htmlFor="f-sort" className="label">Sort</label>
          <select id="f-sort" name="sort" defaultValue={search.sort ?? "featured"} className="input">
            {SORTS.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="inStock" value="1" defaultChecked={search.inStock === "1"} className="size-4" />
          In stock only
        </label>
        {search.ingredient && <input type="hidden" name="ingredient" value={search.ingredient} />}
        <div className="flex gap-2">
          <button className="btn btn-primary">Apply</button>
          {hasFilters && <Link href={basePath} className="btn btn-ghost">Clear</Link>}
        </div>
      </form>

      {failed && (
        <div className="card p-8 text-center">
          <p className="mb-4">We could not load products right now.</p>
          <Link href={pageHref(Number(search.page ?? 1))} className="btn btn-secondary">Try again</Link>
        </div>
      )}
      {data && (
        <>
          <p className="mb-4 text-sm text-muted" aria-live="polite">
            {data.total} product{data.total === 1 ? "" : "s"}
            {search.q ? ` matching “${search.q}”` : ""}
            {search.ingredient ? ` featuring this ingredient` : ""}
          </p>
          {data.items.length === 0 ? (
            <div className="card p-10 text-center">
              <p className="mb-2 font-display text-xl">No products match these filters.</p>
              <p className="mb-6 text-muted">Try a broader search, or browse everything.</p>
              <Link href="/shop" className="btn btn-primary">View all products</Link>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
              {data.items.map((p, i) => (
                <Reveal as="li" key={p.id} delay={(i % 4) * 80}>
                  <ProductCard p={p} priority={i < 4} />
                </Reveal>
              ))}
            </ul>
          )}
          {pages > 1 && (
            <nav aria-label="Pagination" className="mt-10 flex justify-center gap-2">
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <Link key={p} href={pageHref(p)} aria-current={p === data!.page ? "page" : undefined} className={`btn ${p === data!.page ? "btn-primary" : "btn-secondary"} tabular`}>
                  {p}
                </Link>
              ))}
            </nav>
          )}
        </>
      )}
    </div>
  );
}

/** Page header for every inner page: light colour mesh, dotted grid, masked headline. Slides under the floating header. */
export function PageIntro({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="hero-light -mt-[84px] overflow-hidden pt-[84px]">
      <div className="mesh" aria-hidden="true">
        <span className="right-[4%] top-[-30%] h-[22rem] w-[22rem] bg-[#f3d49a]" />
        <span className="left-[-8%] top-[10%] h-[18rem] w-[18rem] bg-[#f4cdc2]" style={{ animationDelay: "-9s" }} />
      </div>
      <div className="dot-grid" aria-hidden="true" />
      <header className="relative mx-auto max-w-[1400px] px-5 pb-12 pt-12 sm:px-8 sm:pb-16 sm:pt-16">
        {eyebrow && (
          <p className="eyebrow rise mb-4 flex items-center gap-3">
            <span className="inline-block h-px w-10 bg-kesar" aria-hidden="true" />
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-5xl leading-[1.02] tracking-[-0.03em] sm:text-7xl">
          <Kinetic text={title} className="mask-words" />
        </h1>
        {children && <div className="rise relative mt-5 max-w-2xl text-lg text-muted" style={{ animationDelay: "300ms" }}>{children}</div>}
      </header>
    </div>
  );
}

export const Container = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`mx-auto max-w-[1400px] px-5 sm:px-8 ${className}`}>{children}</div>
);
