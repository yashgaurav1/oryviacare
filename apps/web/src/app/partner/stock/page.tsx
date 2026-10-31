import { Pending } from "@/components/sections";

export default function PartnerStock() {
  return (
    <div>
      <h1 className="mb-6 font-display text-4xl">Reorder / Stock</h1>
      <Pending title="Stock requests are not built yet" actions={[{ href: "/partner", label: "Back to overview" }]}>
        Replenishment requests and partner-reported stock are planned for Phase F. Oryvia warehouse stock and partner stock will be kept separate.
      </Pending>
    </div>
  );
}
