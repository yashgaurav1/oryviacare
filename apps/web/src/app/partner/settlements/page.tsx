import { Pending } from "@/components/sections";

export default function PartnerSettlements() {
  return (
    <div>
      <h1 className="mb-6 font-display text-4xl">Settlements</h1>
      <Pending title="No settlements" actions={[{ href: "/partner", label: "Back to overview" }]}>
        Settlements only exist once an approved commission programme produces eligible earnings.
      </Pending>
    </div>
  );
}
