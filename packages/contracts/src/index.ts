// Shared request/response contracts. The API validates every body with these schemas;
// the web app uses the same types. Money is always integer paise.
import { z } from "zod";

export const PIN_CODE = /^[1-9][0-9]{5}$/;
export const INDIAN_MOBILE = /^(?:\+91[-\s]?)?[6-9]\d{9}$/;
export const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const AddressInput = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(INDIAN_MOBILE, "Enter a 10-digit Indian mobile number"),
  line1: z.string().trim().min(3).max(200),
  line2: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  postalCode: z.string().trim().regex(PIN_CODE, "Enter a valid 6-digit PIN code"),
});
export type AddressInput = z.infer<typeof AddressInput>;

export const CartItemInput = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
});
export const CartQuantityInput = z.object({ quantity: z.number().int().min(1).max(99) });

export const CheckoutQuoteInput = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  shippingAddress: AddressInput,
  billingSameAsShipping: z.boolean().default(true),
  billingAddress: AddressInput.optional(),
});
export type CheckoutQuoteInput = z.infer<typeof CheckoutQuoteInput>;

export const PlaceOrderInput = z.object({
  quoteHash: z.string().min(16).max(128),
  paymentMethod: z.enum(["razorpay", "dev_manual"]),
  checkout: CheckoutQuoteInput,
});
export type PlaceOrderInput = z.infer<typeof PlaceOrderInput>;

export const ContactInput = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: z.string().trim().regex(INDIAN_MOBILE).optional().or(z.literal("")),
  topic: z.enum(["product", "order", "business", "ingredients", "other"]),
  message: z.string().trim().min(10).max(4000),
  consentToContact: z.literal(true, { error: "Consent is required so we can reply" }),
});

export const QuoteRequestInput = z.object({
  packageSlug: z.string().max(200).optional(),
  contactName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: z.string().trim().regex(INDIAN_MOBILE, "Enter a 10-digit Indian mobile number"),
  businessName: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const NewsletterInput = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  consent: z.literal(true, { error: "Please confirm you want to receive emails" }),
});

export const OrderTransitionInput = z.object({
  to: z.enum(["confirmed", "cancelled", "closed"]),
  reason: z.string().trim().min(3).max(500),
  version: z.number().int().positive(),
});

export const ProductPublishInput = z.object({
  reason: z.string().trim().min(5).max(500),
  version: z.number().int().positive(),
});

export const PackageApprovalInput = z.object({
  packageVersionId: z.string().uuid(),
  pricePaise: z.number().int().positive(),
  components: z
    .array(z.object({ variantId: z.string().uuid(), paidQty: z.number().int().min(0).max(10000), freeQty: z.number().int().min(0).max(10000) }))
    .min(1),
  reason: z.string().trim().min(10).max(1000),
});

export const StockReceiptInput = z.object({
  variantId: z.string().uuid(),
  warehouseCode: z.string().min(1).max(40),
  quantity: z.number().int().min(1).max(100000),
  lot: z.string().trim().min(1).max(60),
  manufacturedAt: z.string().date().optional(),
  expiresAt: z.string().date().optional(),
  note: z.string().trim().max(500).optional(),
});

// ── Fulfilment, returns, refunds ──
const Reason = z.string().trim().min(3).max(500);
const LineQuantities = z
  .array(z.object({ orderLineId: z.string().uuid(), quantity: z.number().int().min(1).max(999) }))
  .min(1)
  .max(100)
  .refine((ls) => new Set(ls.map((l) => l.orderLineId)).size === ls.length, "Each line may appear once");

export const ShipmentCreateInput = z.object({ version: z.number().int().positive(), lines: LineQuantities, note: z.string().trim().max(500).optional() });
export const ShipmentDispatchInput = z.object({
  carrier: z.string().trim().min(2).max(80),
  trackingRef: z.string().trim().max(120).optional().or(z.literal("")),
});
export const ShipmentReasonInput = z.object({ reason: Reason });
export const LineCancelInput = z.object({ version: z.number().int().positive(), lines: LineQuantities, reason: Reason });

export const ReturnRequestInput = z.object({ lines: LineQuantities, reason: Reason });
export const ReturnDecisionInput = z.object({ decision: z.enum(["approved", "rejected"]), note: Reason, version: z.number().int().positive() });
export const ReturnReceiveInput = z.object({ version: z.number().int().positive(), note: z.string().trim().max(500).optional() });
export const ReturnInspectInput = z.object({ disposition: z.enum(["restocked", "disposed"]), note: Reason });

export const RefundRequestInput = z.object({
  amountPaise: z.number().int().min(1).max(100_000_000),
  reason: Reason,
  returnRequestId: z.string().uuid().optional(),
});
export const RefundDecisionInput = z.object({ decision: z.enum(["approved", "rejected"]), note: Reason });

export const PartnerApplicationInput = z.object({
  programmeKey: z.string().min(1).max(60),
  businessType: z.enum(["salon", "retailer", "distributor"]),
  businessName: z.string().trim().min(2).max(200),
  legalName: z.string().trim().max(200).optional().or(z.literal("")),
  gstin: z.string().trim().toUpperCase().regex(GSTIN, "GSTIN format looks incorrect").optional().or(z.literal("")),
  contactName: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(INDIAN_MOBILE),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  postalCode: z.string().trim().regex(PIN_CODE),
  serviceRegion: z.string().trim().max(200).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  acceptTerms: z.boolean(),
});

export const ApplicationDecisionInput = z.object({
  to: z.enum(["under_review", "needs_information", "approved", "rejected", "suspended"]),
  reason: z.string().trim().min(5).max(1000),
  requestedFields: z.array(z.string().max(60)).max(30).optional(),
  version: z.number().int().positive(),
});

export const PageQuery = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});

export type ApiErrorCode =
  | "validation_failed"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "stale_version"
  | "stock_unavailable"
  | "commercial_conflict"
  | "integration_unavailable"
  | "idempotency_conflict"
  | "rate_limited";

export interface ApiError {
  error: { code: ApiErrorCode; message: string; fields?: Record<string, string[]>; requestId?: string };
}

export const formatPaise = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: paise % 100 ? 2 : 0 }).format(paise / 100);
