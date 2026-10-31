import { Pending } from "@/components/sections";

export default function Wishlist() {
  return (
    <div>
      <h1 className="mb-6 font-display text-4xl">Saved products</h1>
      <Pending title="Saved products are not available yet" actions={[{ href: "/shop", label: "Continue shopping" }]}>
        Saving products to a wishlist is not built yet. The database model exists; the feature is listed as not implemented in the build status.
      </Pending>
    </div>
  );
}
