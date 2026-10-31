import { Pending } from "@/components/sections";

export default function PartnerTeam() {
  return (
    <div>
      <h1 className="mb-6 font-display text-4xl">Team</h1>
      <Pending title="Team invitations are not built yet" actions={[{ href: "/partner", label: "Back to overview" }]}>
        Inviting staff to your business account is planned for Phase F.
      </Pending>
    </div>
  );
}
