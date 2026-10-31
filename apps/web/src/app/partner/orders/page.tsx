import { Pending } from "@/components/sections";

export default function PartnerOrders() {
  return (
    <div>
      <h1 className="mb-6 font-display text-4xl">Orders</h1>
      <Pending title="Wholesale ordering is not built yet" actions={[{ href: "/partner", label: "Back to overview" }]}>
        Bulk ordering with partner price lists is planned for Phase F. Request a quote for packages in the meantime.
      </Pending>
    </div>
  );
}
