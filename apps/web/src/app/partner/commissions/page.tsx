import { Pending } from "@/components/sections";

export default function PartnerCommissions() {
  return (
    <div>
      <h1 className="mb-6 font-display text-4xl">Commissions</h1>
      <Pending title="No commission programme" actions={[{ href: "/partner", label: "Back to overview" }]}>
        Oryvia has not approved a commission rule, so no commission is earned or shown.
      </Pending>
    </div>
  );
}
