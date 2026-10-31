import { Pending } from "@/components/sections";

export default function PartnerSettings() {
  return (
    <div>
      <h1 className="mb-6 font-display text-4xl">Settings</h1>
      <Pending title="Business settings are not editable yet" actions={[{ href: "/partner", label: "Back to overview" }]}>
        Contact Oryvia to change your business details.
      </Pending>
    </div>
  );
}
