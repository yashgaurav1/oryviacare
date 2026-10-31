import { api } from "@/lib/api";
import { formatDateTime, titleCase } from "@/lib/format";
import { ReasonAction } from "../admin-actions";

type App = {
  id: string;
  reference: string;
  state: string;
  version: number;
  data: Record<string, string>;
  submittedAt: string | null;
  user: { email: string; name: string };
  programme: { name: string };
  reviews: Array<{ id: string; fromState: string; toState: string; reason: string; createdAt: string }>;
};

const NEXT: Record<string, Array<[string, string, "primary" | "secondary" | "danger"]>> = {
  submitted: [["under_review", "Start review", "secondary"], ["needs_information", "Request information", "secondary"], ["approved", "Approve", "primary"], ["rejected", "Reject", "danger"]],
  under_review: [["needs_information", "Request information", "secondary"], ["approved", "Approve", "primary"], ["rejected", "Reject", "danger"]],
  needs_information: [["rejected", "Reject", "danger"]],
  approved: [["suspended", "Suspend", "danger"]],
  suspended: [["approved", "Reinstate", "primary"]],
};

export default async function Applications() {
  const apps = await api<App[]>("/v1/admin/applications");
  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl">Partner applications</h1>
      {apps.length === 0 && <p className="card p-6 text-muted">No applications yet.</p>}
      <ul className="space-y-4">
        {apps.map((a) => (
          <li key={a.id} className="card space-y-3 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-display text-xl">{a.data.businessName} <span className="tabular text-sm text-muted">{a.reference}</span></p>
              <span className="rounded bg-sunk px-2 py-1 text-xs">{titleCase(a.state)}</span>
            </div>
            <p className="text-sm text-muted">{a.programme.name} · {a.user.name} ({a.user.email}) · {a.submittedAt ? `submitted ${formatDateTime(a.submittedAt)}` : "draft"}</p>
            <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              {Object.entries(a.data).filter(([k, v]) => v && k !== "acceptTerms").map(([k, v]) => <div key={k} className="flex gap-2"><dt className="text-muted">{titleCase(k.replace(/([A-Z])/g, "_$1"))}:</dt><dd>{String(v)}</dd></div>)}
            </dl>
            {a.reviews.length > 0 && <ol className="border-l-2 border-gold-soft pl-4 text-sm">{a.reviews.map((r) => <li key={r.id}>{titleCase(r.fromState)} → {titleCase(r.toState)}: {r.reason} <span className="text-muted">· {formatDateTime(r.createdAt)}</span></li>)}</ol>}
            <div className="flex flex-wrap gap-2">
              {(NEXT[a.state] ?? []).map(([to, label, tone]) => (
                <ReasonAction key={to} label={label} tone={tone} path={`/v1/admin/applications/${a.id}/decision`} body={{ to, version: a.version }} confirm={to === "approved" ? "Creates the business account and gives this user partner access." : undefined} />
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
