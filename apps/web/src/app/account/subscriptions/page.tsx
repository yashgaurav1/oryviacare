import { Pending } from "@/components/sections";

export default function Subscriptions() {
  return (
    <div>
      <h1 className="mb-6 font-display text-4xl">Subscriptions</h1>
      <Pending title="Subscriptions are not available yet" actions={[{ href: "/shop", label: "Continue shopping" }]}>
        Recurring delivery requires a payment provider that supports mandates and merchant approval. Neither is set up, so no subscriptions exist.
      </Pending>
    </div>
  );
}
