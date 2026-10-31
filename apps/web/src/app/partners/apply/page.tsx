import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageIntro } from "@/components/catalog-listing";
import { Banner } from "@/components/forms";
import { api, apiOrNull, type Me } from "@/lib/api";
import { formatDate, titleCase } from "@/lib/format";
import { ApplyForm } from "./apply-form";

export const metadata: Metadata = { title: "Apply as a partner" };

type App = { reference: string; state: string; programme: string; data: Record<string, string | boolean>; submittedAt: string | null; history: Array<{ toState: string; reason: string; createdAt: string }> };

export default async function Apply() {
  const me = await apiOrNull<Me>("/v1/account/me");
  const programmes = await api<Array<{ key: string; name: string; businessType: string }>>("/v1/partner/programmes");
  if (!me)
    return (
      <>
        <PageIntro eyebrow="Oryvia Pro" title="Apply as a partner">Create an account or sign in first, so you can save your application and follow its review.</PageIntro>
        <Container className="flex gap-3">
          <Link href="/register?next=/partners/apply" className="btn btn-primary">Create an account</Link>
          <Link href="/login?next=/partners/apply" className="btn btn-secondary">Sign in</Link>
        </Container>
      </>
    );
  const apps = await api<App[]>("/v1/partner/applications/mine");
  const open = apps.find((a) => ["draft", "needs_information"].includes(a.state));
  const pending = apps.find((a) => ["submitted", "under_review"].includes(a.state));
  const approved = apps.find((a) => a.state === "approved");
  return (
    <>
      <PageIntro eyebrow="Oryvia Pro" title="Apply as a partner" />
      <Container className="max-w-3xl space-y-6">
        {approved && <Banner tone="success">Your application {approved.reference} is approved. <Link href="/partner" className="underline">Open your workspace</Link>.</Banner>}
        {pending && <Banner tone="info">Application {pending.reference} was submitted{pending.submittedAt ? ` on ${formatDate(pending.submittedAt)}` : ""} and is {titleCase(pending.state).toLowerCase()}.</Banner>}
        {open?.state === "needs_information" && (
          <Banner tone="warning">Oryvia asked for more information: {open.history.at(-1)?.reason}</Banner>
        )}
        {!pending && !approved && (
          <div className="card p-6 sm:p-8">
            <ApplyForm programmes={programmes} existing={open ? { data: open.data, state: open.state } : null} />
          </div>
        )}
      </Container>
    </>
  );
}
