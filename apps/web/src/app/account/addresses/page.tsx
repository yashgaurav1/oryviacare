import { Pending } from "@/components/sections";

export default function Addresses() {
  return (
    <div>
      <h1 className="mb-6 font-display text-4xl">Saved addresses</h1>
      <Pending title="Saved addresses are not available yet" actions={[{ href: "/shop", label: "Continue shopping" }]}>
        Saved addresses are not built yet. Enter your address at checkout; it is stored with that order.
      </Pending>
    </div>
  );
}
