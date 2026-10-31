import { Pending } from "@/components/sections";

export default function PartnerQuotes() {
  return (
    <div>
      <h1 className="mb-6 font-display text-4xl">Quotes</h1>
      <Pending title="Quote requests" actions={[{ href: "/partner", label: "Back to overview" }]}>
        Your quote requests are listed on the Overview page. Accepting and converting approved quotes into orders is not built yet.
      </Pending>
    </div>
  );
}
