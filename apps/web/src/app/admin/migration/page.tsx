import { api } from "@/lib/api";
import { formatDateTime, titleCase } from "@/lib/format";
import { ReasonAction } from "../admin-actions";

type Ex = { id: string; entityKey: string; field: string; issue: string; severity: string; evidence: string | null; sourceUrl: string | null; status: string; resolution: string | null };
type Data = { exceptions: Ex[]; runs: Array<{ id: string; kind: string; status: string; dryRun: boolean; startedAt: string; summary: Record<string, unknown> | null }>; coverage: Array<{ status: string; count: number }> };

const ORDER = ["blocker", "high", "medium", "low"];

export default async function Migration({ searchParams }: { searchParams: Promise<{ status?: string; severity?: string }> }) {
  const sp = await searchParams;
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]);
  const d = await api<Data>(`/v1/admin/migration/exceptions?${qs}`);
  const rows = [...d.exceptions].sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity));
  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl">Migration review</h1>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-2 font-medium">Source URL coverage</h2>
          <ul className="text-sm">{d.coverage.map((c) => <li key={c.status} className="flex justify-between"><span>{titleCase(c.status)}</span><span className="tabular">{c.count}</span></li>)}</ul>
          <p className="mt-2 text-xs text-muted">Scope: public pages from robots.txt sitemaps and internal links, plus public WooCommerce/WP REST endpoints. See docs/SOURCE_AUDIT.md.</p>
        </section>
        <section className="card p-5">
          <h2 className="mb-2 font-medium">Import runs</h2>
          <ul className="text-sm">{d.runs.map((r) => <li key={r.id}>{formatDateTime(r.startedAt)} · {r.kind} · {r.status}{r.dryRun ? " (dry run)" : ""}</li>)}</ul>
        </section>
      </div>
      <form method="get" className="flex flex-wrap items-end gap-3">
        <div><label htmlFor="st" className="label">Status</label><select id="st" name="status" defaultValue={sp.status ?? ""} className="input"><option value="">Any</option><option value="open">Open</option><option value="resolved">Resolved</option><option value="accepted">Accepted</option></select></div>
        <div><label htmlFor="sv" className="label">Severity</label><select id="sv" name="severity" defaultValue={sp.severity ?? ""} className="input"><option value="">Any</option>{ORDER.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</select></div>
        <button className="btn btn-secondary">Filter</button>
      </form>
      <p className="text-sm text-muted">{rows.length} exception{rows.length === 1 ? "" : "s"}</p>
      <ul className="space-y-3">
        {rows.map((e) => (
          <li key={e.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 max-w-3xl">
                <p className="text-xs text-muted">{e.entityKey} · {e.field}</p>
                <p className="font-medium">{e.issue}</p>
                {e.evidence && <p className="mt-1 break-words text-sm text-muted">{e.evidence}</p>}
                {e.sourceUrl && <p className="mt-1 break-all text-xs text-teal">{e.sourceUrl}</p>}
                {e.resolution && <p className="mt-2 text-sm">Resolution: {e.resolution}</p>}
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`rounded px-2 py-0.5 text-xs ${e.severity === "blocker" ? "bg-error-bg text-error" : e.severity === "high" ? "bg-warning-bg text-warning" : "bg-sunk"}`}>{titleCase(e.severity)} · {titleCase(e.status)}</span>
                {e.status === "open" && (
                  <div className="flex flex-wrap justify-end gap-2">
                    <ReasonAction label="Mark resolved" tone="secondary" path={`/v1/admin/migration/exceptions/${e.id}/resolve`} body={{ status: "resolved" }} reasonLabel="How was it resolved?" />
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
