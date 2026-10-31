// One-time owner bootstrap. Not reachable over HTTP. The person must first register normally
// (so no password is ever set or printed here); this grants the owner role to that account once.
// Refuses to run if any owner already exists.
// Usage: npm run bootstrap:owner -w @oryvia/api -- --email someone@example.com
import { prisma } from "../core/db.js";

const i = process.argv.indexOf("--email");
const email = i > 0 ? process.argv[i + 1]?.toLowerCase() : undefined;
if (!email) {
  console.error("Usage: bootstrap-owner --email <registered email>");
  process.exit(2);
}
const ownerRole = await prisma.role.findUnique({ where: { key: "owner" } });
if (!ownerRole) throw new Error("Run seed:reference first");
const existing = await prisma.staffRoleAssignment.count({ where: { roleId: ownerRole.id } });
if (existing > 0) {
  console.error("An owner already exists. Further staff must be invited from Admin → Team by an owner.");
  process.exit(1);
}
const user = await prisma.user.findUnique({ where: { email } });
if (!user) {
  console.error("No registered account with that email. Register at /register first.");
  process.exit(1);
}
await prisma.$transaction([
  prisma.staffRoleAssignment.create({ data: { userId: user.id, roleId: ownerRole.id, grantedBy: "bootstrap-cli" } }),
  prisma.auditEvent.create({ data: { action: "owner.bootstrap", objectType: "user", objectId: user.id, reason: "One-time owner bootstrap via CLI" } }),
]);
console.log(`Owner role granted to ${email}. Enable two-factor authentication before approving prices or packages.`);
await prisma.$disconnect();
