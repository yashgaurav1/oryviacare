import { Pending } from "@/components/sections";

export default function PartnerResources() {
  return (
    <div>
      <h1 className="mb-6 font-display text-4xl">Resources</h1>
      <Pending title="No resources published yet" actions={[{ href: "/partner", label: "Back to overview" }]}>
        Price lists, brochures and marketing assets will appear here once Oryvia publishes them.
      </Pending>
    </div>
  );
}
