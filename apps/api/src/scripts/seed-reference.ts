// Reference data safe for every environment: permissions, system roles, retail price list, partner programmes.
// Creates no users, no stock, no orders and no prices. Idempotent.
// Usage: npm run seed:reference -w @oryvia/api
import { prisma } from "../core/db.js";
import { PERMISSIONS, STAFF_ROLES } from "../core/permissions.js";

for (const [key, description] of Object.entries(PERMISSIONS))
  await prisma.permission.upsert({ where: { key }, create: { key, description }, update: { description } });

for (const [key, def] of Object.entries(STAFF_ROLES)) {
  const role = await prisma.role.upsert({ where: { key }, create: { key, name: def.name, scope: "staff", system: true }, update: { name: def.name } });
  // System roles are reset to their defined bundle; custom roles are left untouched.
  await prisma.rolePermission.deleteMany({ where: { roleId: role.id, permissionKey: { notIn: def.permissions } } });
  for (const permissionKey of def.permissions)
    await prisma.rolePermission.upsert({ where: { roleId_permissionKey: { roleId: role.id, permissionKey } }, create: { roleId: role.id, permissionKey }, update: {} });
}

await prisma.priceList.upsert({ where: { key: "retail-inr" }, create: { key: "retail-inr", name: "Retail (INR)", audience: "retail" }, update: {} });

// Programme structure only. Benefits, pricing, commission and territory remain merchant decisions (docs/DECISIONS.md).
for (const [key, name, businessType] of [
  ["salon", "Salon partner", "salon"],
  ["retailer", "Retail partner", "retailer"],
  ["distributor", "Distributor", "distributor"],
] as const) {
  const p = await prisma.partnerProgramme.upsert({
    where: { key },
    create: { key, name, businessType, requiredDocs: [{ kind: "gst_certificate", required: false, note: "Only if GST-registered" }] },
    update: { name },
  });
  await prisma.partnerTier.upsert({ where: { programmeId_key: { programmeId: p.id, key: "standard" } }, create: { programmeId: p.id, key: "standard", name: "Standard" }, update: {} });
}

for (const capability of ["database", "sessions", "files", "email", "payments", "shipping", "whatsapp_link", "whatsapp_api", "search", "ai", "analytics", "recurring_billing", "payouts"])
  await prisma.integrationStatus.upsert({ where: { capability }, create: { capability }, update: {} });

// Contact details observed on the source site are stored UNVERIFIED; the storefront hides them until a merchant verifies them.
await prisma.storeSetting.upsert({
  where: { key: "contact.public" },
  create: {
    key: "contact.public",
    value: { phone: "+919105430713", email: "oryviacare@gmail.com", whatsapp: "919105430713", hours: "Mon – Sat, 10 AM – 6 PM", source: "observed on oryviacare.in 2026-10-31" },
    verified: false,
  },
  update: {},
});

console.log("reference data seeded");
await prisma.$disconnect();
