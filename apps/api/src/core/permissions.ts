// Permission catalogue and baseline staff roles. Roles are editable bundles of permissions;
// these are the system defaults written by `npm run seed:rbac` (safe for production: no users, no data).

export const PERMISSIONS = {
  "orders.read": "View orders, lines, payments and timelines",
  "orders.transition": "Confirm, cancel or close orders",
  "orders.export": "Export order data",
  "orders.fulfil": "Create, dispatch, deliver and void shipments",
  "returns.manage": "Approve, receive and inspect returns",
  "products.read": "View catalogue records including drafts",
  "products.write": "Edit catalogue records",
  "products.publish": "Approve and publish products and their retail prices",
  "packages.review": "Review package evidence",
  "packages.approve": "Approve a package version (price and paid/free composition)",
  "inventory.read": "View stock balances, batches and movements",
  "inventory.write": "Record stock receipts, adjustments, quarantine",
  "customers.read": "View customer profiles and history",
  "support.read": "View enquiries and support tasks",
  "support.write": "Update enquiries and tasks",
  "partners.applications.review": "Review partner applications and documents",
  "partners.applications.decide": "Approve, reject or suspend partner applications",
  "content.write": "Edit pages, articles, FAQs and policies",
  "content.publish": "Publish content and policy versions",
  "migration.review": "View migration evidence and exceptions",
  "migration.resolve": "Resolve migration exceptions",
  "finance.refunds": "Initiate and approve refunds",
  "finance.settlements": "Approve commission settlements",
  "settings.write": "Change store settings",
  "audit.read": "View audit history",
  "team.manage": "Invite staff and assign roles",
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;
const ALL = Object.keys(PERMISSIONS) as PermissionKey[];

export const STAFF_ROLES: Record<string, { name: string; permissions: PermissionKey[] }> = {
  owner: { name: "Owner", permissions: ALL },
  administrator: { name: "Administrator", permissions: ALL.filter((p) => p !== "team.manage") },
  support: { name: "Support", permissions: ["orders.read", "returns.manage", "customers.read", "support.read", "support.write", "products.read"] },
  inventory_operator: { name: "Inventory operator", permissions: ["orders.read", "orders.fulfil", "returns.manage", "inventory.read", "inventory.write", "products.read"] },
  content_operator: { name: "Content & marketing", permissions: ["products.read", "products.write", "content.write", "content.publish"] },
  finance_operator: { name: "Finance operator", permissions: ["orders.read", "orders.export", "finance.refunds", "finance.settlements", "audit.read"] },
  catalogue_reviewer: { name: "Catalogue reviewer", permissions: ["products.read", "products.write", "products.publish", "packages.review", "migration.review", "migration.resolve"] },
};
