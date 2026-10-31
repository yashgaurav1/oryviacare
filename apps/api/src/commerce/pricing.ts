// Server-authoritative pricing. Clients never send prices; every total is recomputed here.
import { createHash } from "node:crypto";
import type { Db, Tx } from "@oryvia/db";
import type { CheckoutQuoteInput } from "@oryvia/contracts";
import { conflict } from "../core/errors.js";
import { availableByVariant } from "./stock.js";

export interface PricedVariant {
  variantId: string;
  productId: string;
  productSlug: string;
  productName: string;
  variantTitle: string | null;
  unitPaise: number;
  referencePaise: number | null;
  referenceLabel: string | null;
  priceEntryId: string;
}

export interface ShippingRule {
  label: string;
  flatPaise: number;
  freeAboveSubtotalPaise: number | null;
  serviceablePinPrefixes: string[];
  isDevelopment: boolean;
}

export interface TaxSetting {
  mode: "inclusive" | "exclusive";
  configured: boolean;
  note: string;
}

const DEFAULT_TAX: TaxSetting = {
  mode: "inclusive",
  configured: false,
  note: "Prices are shown as published. GST breakdown is pending merchant tax configuration; no tax invoice is issued.",
};

/** Purchasable = published product, active variant, approved/published retail price effective now. */
export async function priceVariants(db: Db | Tx, variantIds: string[], now = new Date()): Promise<Map<string, PricedVariant>> {
  if (!variantIds.length) return new Map();
  const variants = await db.variant.findMany({
    where: { id: { in: variantIds }, active: true, product: { status: "published" } },
    include: {
      product: { select: { id: true, slug: true, name: true } },
      prices: {
        where: {
          priceList: { key: "retail-inr", status: "active" },
          reviewState: { in: ["approved", "published"] },
          minQuantity: 1,
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
        },
        orderBy: { effectiveFrom: "desc" },
        take: 1,
      },
    },
  });
  const out = new Map<string, PricedVariant>();
  for (const v of variants) {
    const price = v.prices[0];
    if (!price) continue;
    out.set(v.id, {
      variantId: v.id,
      productId: v.product.id,
      productSlug: v.product.slug,
      productName: v.product.name,
      variantTitle: v.title,
      unitPaise: price.unitPaise,
      referencePaise: price.referencePaise,
      referenceLabel: price.referenceLabel,
      priceEntryId: price.id,
    });
  }
  return out;
}

export async function getSetting<T>(db: Db | Tx, key: string): Promise<{ value: T; version: number } | null> {
  const s = await db.storeSetting.findUnique({ where: { key } });
  return s ? { value: s.value as T, version: s.version } : null;
}

export interface QuoteLine extends PricedVariant {
  quantity: number;
  lineSubtotalPaise: number;
  availableQuantity: number;
}

export interface Quote {
  lines: QuoteLine[];
  problems: Array<{ variantId: string; code: "unavailable" | "insufficient_stock" | "not_purchasable"; message: string }>;
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  taxPaise: number;
  totalPaise: number;
  tax: TaxSetting;
  shipping: { label: string; isDevelopment: boolean } | null;
  hash: string;
  computedAt: string;
}

/** Build a server quote from cart lines. Address is only needed for serviceability and shipping. */
export async function buildQuote(
  db: Db | Tx,
  items: Array<{ variantId: string; quantity: number }>,
  checkout?: Pick<CheckoutQuoteInput, "shippingAddress"> | null,
): Promise<Quote> {
  const merged = new Map<string, number>();
  for (const i of items) merged.set(i.variantId, (merged.get(i.variantId) ?? 0) + i.quantity);
  const priced = await priceVariants(db, [...merged.keys()]);
  const available = await availableByVariant(db, [...merged.keys()]);
  const lines: QuoteLine[] = [];
  const problems: Quote["problems"] = [];
  for (const [variantId, quantity] of merged) {
    const p = priced.get(variantId);
    if (!p) {
      problems.push({ variantId, code: "not_purchasable", message: "This item is not currently available to buy" });
      continue;
    }
    const avail = available.get(variantId) ?? 0;
    if (avail < quantity)
      problems.push({ variantId, code: avail === 0 ? "unavailable" : "insufficient_stock", message: avail === 0 ? "Out of stock" : `Only ${avail} available` });
    lines.push({ ...p, quantity, lineSubtotalPaise: p.unitPaise * quantity, availableQuantity: avail });
  }
  const subtotalPaise = lines.reduce((s, l) => s + l.lineSubtotalPaise, 0);
  const tax = (await getSetting<TaxSetting>(db, "tax"))?.value ?? DEFAULT_TAX;

  let shippingPaise = 0;
  let shipping: Quote["shipping"] = null;
  const ruleSetting = await getSetting<ShippingRule>(db, "shipping.rule");
  if (checkout?.shippingAddress) {
    if (!ruleSetting) throw conflict("Delivery charges are not configured yet, so orders cannot be placed. Please contact us.");
    const rule = ruleSetting.value;
    const pin = checkout.shippingAddress.postalCode;
    if (rule.serviceablePinPrefixes.length && !rule.serviceablePinPrefixes.some((p) => pin.startsWith(p)))
      throw conflict(`We do not deliver to PIN code ${pin} yet.`);
    shippingPaise = rule.freeAboveSubtotalPaise !== null && subtotalPaise >= rule.freeAboveSubtotalPaise ? 0 : rule.flatPaise;
    shipping = { label: rule.label, isDevelopment: rule.isDevelopment };
  }
  const discountPaise = 0;
  const taxPaise = 0; // not computed until merchant tax configuration is verified (see tax.note)
  const totalPaise = subtotalPaise - discountPaise + shippingPaise + (tax.mode === "exclusive" ? taxPaise : 0);
  const hash = createHash("sha256")
    .update(
      JSON.stringify({
        l: lines.map((l) => [l.variantId, l.quantity, l.unitPaise, l.priceEntryId]),
        s: shippingPaise,
        t: [tax.mode, taxPaise],
        d: discountPaise,
        a: checkout?.shippingAddress?.postalCode ?? null,
        v: [ruleSetting?.version ?? 0],
      }),
    )
    .digest("hex")
    .slice(0, 40);
  return { lines, problems, subtotalPaise, discountPaise, shippingPaise, taxPaise, totalPaise, tax, shipping, hash, computedAt: new Date().toISOString() };
}
