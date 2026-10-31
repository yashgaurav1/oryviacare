import { Pending } from "@/components/sections";

export default function Rewards() {
  return (
    <div>
      <h1 className="mb-6 font-display text-4xl">Rewards</h1>
      <Pending title="Rewards are not available yet" actions={[{ href: "/shop", label: "Continue shopping" }]}>
        Oryvia has not approved a rewards programme, so no points are earned or shown. No balance appears without a recorded event.
      </Pending>
    </div>
  );
}
