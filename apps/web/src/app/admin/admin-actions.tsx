"use client";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Banner, Field } from "@/components/forms";
import { call, type ClientError } from "@/lib/client";

/**
 * A mutation with an explicit reason, confirmation at the point of execution, version check (409 on stale data)
 * and visible server result. Used for every state-changing admin action.
 */
export function ReasonAction({
  label,
  path,
  body,
  tone = "primary",
  confirm,
  reasonLabel = "Reason (recorded in the audit log)",
  reasonField = "reason",
  extra,
}: {
  label: string;
  path: string;
  body: Record<string, unknown>;
  tone?: "primary" | "danger" | "secondary";
  confirm?: string;
  reasonLabel?: string;
  /** Body key the reason is sent as (some endpoints call it `note`). */
  reasonField?: string;
  extra?: ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<ClientError | null>(null);
  const [busy, setBusy] = useState(false);
  if (!open)
    return (
      <button className={`btn btn-${tone === "danger" ? "danger" : tone}`} onClick={() => setOpen(true)}>
        {label}
      </button>
    );
  return (
    <form
      className="card w-full space-y-3 p-4 ring-1 ring-divider"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const r = await call(path, { method: "POST", body: { ...body, [reasonField]: reason } });
        setBusy(false);
        if (!r.ok) return setError(r.error);
        setOpen(false);
        setReason("");
        router.refresh();
      }}
    >
      {confirm && <p className="text-sm">{confirm}</p>}
      {extra}
      <Field id={`reason-${label}`} label={reasonLabel} error={error?.fields?.[reasonField]}>
        <input id={`reason-${label}`} className="input" value={reason} onChange={(e) => setReason(e.target.value)} minLength={3} required />
      </Field>
      {error && !error.fields?.[reasonField] && <Banner tone="error">{error.message}</Banner>}
      <div className="flex gap-2">
        <button className={`btn btn-${tone === "danger" ? "danger" : "primary"}`} disabled={busy || reason.trim().length < 3}>{busy ? "Saving…" : `Confirm: ${label}`}</button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

/** Generic JSON form post with field errors, used for receipts/settings/approvals. */
export function useAdminPost() {
  const router = useRouter();
  const [error, setError] = useState<ClientError | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const post = async (path: string, body: unknown, successMessage: string) => {
    setBusy(true);
    setError(null);
    setDone(null);
    const r = await call(path, { method: "POST", body });
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return false;
    }
    setDone(successMessage);
    router.refresh();
    return true;
  };
  return { post, error, busy, done, fields: error?.fields ?? {} };
}
