import { api } from "@/lib/api";
import { formatDateTime, titleCase } from "@/lib/format";
import { ReasonAction } from "../admin-actions";

type D = {
  enquiries: Array<{ id: string; reference: string; name: string; email: string; phone: string | null; topic: string; message: string; status: string; createdAt: string }>;
  quotes: Array<{ id: string; reference: string; contactName: string; email: string; phone: string; businessName: string | null; city: string | null; message: string | null; status: string; createdAt: string; package: { name: string } | null }>;
  tasks: Array<{ id: string; title: string; dueAt: string | null }>;
};

export default async function Enquiries() {
  const d = await api<D>("/v1/admin/enquiries");
  return (
    <div className="space-y-8">
      <h1 className="font-display text-4xl">Enquiries &amp; quotes</h1>
      <section>
        <h2 className="mb-3 font-display text-2xl">Open follow-up tasks ({d.tasks.length})</h2>
        <ul className="card divide-y divide-divider">
          {d.tasks.length === 0 && <li className="p-4 text-muted">No open tasks.</li>}
          {d.tasks.map((t) => <li key={t.id} className="flex justify-between gap-3 p-4 text-sm"><span>{t.title}</span>{t.dueAt && <span className="text-muted">due {formatDateTime(t.dueAt)}</span>}</li>)}
        </ul>
      </section>
      <section>
        <h2 className="mb-3 font-display text-2xl">Contact enquiries</h2>
        {d.enquiries.length === 0 ? <p className="card p-4 text-muted">No enquiries yet.</p> : (
          <ul className="space-y-3">
            {d.enquiries.map((e) => (
              <li key={e.id} className="card space-y-2 p-5">
                <p className="text-sm text-muted"><span className="tabular">{e.reference}</span> · {titleCase(e.topic)} · {formatDateTime(e.createdAt)} · <strong>{titleCase(e.status)}</strong></p>
                <p className="font-medium">{e.name} · {e.email}{e.phone ? ` · ${e.phone}` : ""}</p>
                <p className="whitespace-pre-wrap text-sm">{e.message}</p>
                {e.status !== "resolved" && (
                  <div className="flex flex-wrap gap-2">
                    {e.status === "open" && <ReasonAction label="Start handling" tone="secondary" path={`/v1/admin/enquiries/${e.id}/status`} body={{ status: "in_progress" }} reasonLabel="Internal note" />}
                    <ReasonAction label="Mark resolved" path={`/v1/admin/enquiries/${e.id}/status`} body={{ status: "resolved" }} reasonLabel="How was it resolved? (internal note)" />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="mb-3 font-display text-2xl">Package quote requests</h2>
        {d.quotes.length === 0 ? <p className="card p-4 text-muted">No quote requests yet.</p> : (
          <ul className="space-y-3">
            {d.quotes.map((q) => (
              <li key={q.id} className="card p-5 text-sm">
                <p className="text-muted"><span className="tabular">{q.reference}</span> · {q.package?.name ?? "General"} · {formatDateTime(q.createdAt)} · {titleCase(q.status)}</p>
                <p className="font-medium">{q.contactName}{q.businessName ? ` (${q.businessName})` : ""} · {q.email} · {q.phone}{q.city ? ` · ${q.city}` : ""}</p>
                {q.message && <p className="mt-1">{q.message}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
