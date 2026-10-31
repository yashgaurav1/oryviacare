import Link from "next/link";
import type { ReactNode } from "react";

export type Section = { heading: string | null; paragraphs: string[]; items: string[] };

/** Renders imported/CMS sections as plain text nodes (never raw HTML), so stored content cannot inject markup. */
export function Sections({ sections }: { sections: Section[] }) {
  return (
    <div className="prose-oryvia">
      {sections.map((s, i) => (
        <section key={i}>
          {s.heading && <h2>{s.heading}</h2>}
          {s.paragraphs.map((p, j) => <p key={j}>{p}</p>)}
          {s.items.length > 0 && <ul>{s.items.map((it, j) => <li key={j}>{it}</li>)}</ul>}
        </section>
      ))}
    </div>
  );
}

/** Honest state for a page whose content or workflow is not ready. Never a fake control. */
export function Pending({ title, children, actions }: { title: string; children: ReactNode; actions?: Array<{ href: string; label: string }> }) {
  return (
    <div className="card p-8 sm:p-10">
      <p className="eyebrow mb-2">Not available yet</p>
      <h2 className="mb-3 font-display text-2xl">{title}</h2>
      <div className="max-w-2xl text-muted">{children}</div>
      {actions && (
        <div className="mt-6 flex flex-wrap gap-3">
          {actions.map((a, i) => (
            <Link key={a.href} href={a.href} className={`btn ${i === 0 ? "btn-primary" : "btn-secondary"}`}>{a.label}</Link>
          ))}
        </div>
      )}
    </div>
  );
}
