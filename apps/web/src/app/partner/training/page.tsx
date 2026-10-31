import { Pending } from "@/components/sections";

export default function PartnerTraining() {
  return (
    <div>
      <h1 className="mb-6 font-display text-4xl">Training</h1>
      <Pending title="No training modules yet" actions={[{ href: "/partner", label: "Back to overview" }]}>
        Training modules will appear here once Oryvia publishes them.
      </Pending>
    </div>
  );
}
