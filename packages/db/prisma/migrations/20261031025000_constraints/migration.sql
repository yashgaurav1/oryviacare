-- Invariants Prisma cannot express. Keep in sync with docs/DATA_MODEL.md.

-- Stock: balances never negative, reservations never exceed on-hand.
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_nonnegative" CHECK ("onHand" >= 0 AND "reserved" >= 0 AND "reserved" <= "onHand");
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_nonzero" CHECK ("delta" <> 0);
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_positive" CHECK ("quantity" > 0);
-- One balance row per variant/warehouse when batch is NULL (NULLs are distinct in plain unique indexes).
CREATE UNIQUE INDEX "stock_balances_unbatched_unique" ON "stock_balances" ("variantId", "warehouseId") WHERE "batchId" IS NULL;

-- Money and quantities.
ALTER TABLE "price_entries" ADD CONSTRAINT "price_entries_amounts" CHECK ("unitPaise" >= 0 AND ("referencePaise" IS NULL OR "referencePaise" >= 0) AND "minQuantity" >= 1);
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_quantity" CHECK ("quantity" BETWEEN 1 AND 999);
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_one_target" CHECK (("variantId" IS NULL) <> ("packageVersionId" IS NULL));
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_amounts" CHECK ("quantity" > 0 AND "unitPaise" >= 0 AND "lineSubtotalPaise" >= 0 AND "discountPaise" >= 0 AND "taxPaise" >= 0 AND "lineTotalPaise" >= 0 AND "cancelledQty" BETWEEN 0 AND "quantity");
ALTER TABLE "orders" ADD CONSTRAINT "orders_amounts" CHECK ("subtotalPaise" >= 0 AND "discountPaise" >= 0 AND "shippingPaise" >= 0 AND "taxPaise" >= 0 AND "totalPaise" >= 0 AND "currency" = 'INR');
ALTER TABLE "orders" ADD CONSTRAINT "orders_total_reconciles" CHECK ("totalPaise" = "subtotalPaise" - "discountPaise" + "shippingPaise" + CASE WHEN "taxMode" = 'exclusive' THEN "taxPaise" ELSE 0 END);
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_amount" CHECK ("amountPaise" > 0 AND "currency" = 'INR');
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_amount" CHECK ("amountPaise" > 0);
ALTER TABLE "package_components" ADD CONSTRAINT "package_components_qty" CHECK ("paidQty" >= 0 AND "freeQty" >= 0 AND ("paidQty" + "freeQty") > 0);
ALTER TABLE "package_versions" ADD CONSTRAINT "package_versions_approved_has_price" CHECK ("approvalState" <> 'approved' OR ("pricePaise" IS NOT NULL AND "pricePaise" > 0 AND "approvedBy" IS NOT NULL));
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_bounds" CHECK (("percentOff" IS NULL OR "percentOff" BETWEEN 1 AND 100) AND ("amountOffPaise" IS NULL OR "amountOffPaise" > 0) AND "usedCount" >= 0 AND ("usageLimit" IS NULL OR "usedCount" <= "usageLimit"));
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_rating" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "commission_ledger" ADD CONSTRAINT "commission_ledger_nonzero" CHECK ("signedAmountPaise" <> 0);
ALTER TABLE "loyalty_ledger" ADD CONSTRAINT "loyalty_ledger_nonzero" CHECK ("signedPoints" <> 0);

-- Append-only ledgers: block UPDATE/DELETE at the database level.
CREATE OR REPLACE FUNCTION oryvia_reject_ledger_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ledger table % is append-only; write a reversal entry instead', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stock_movements_append_only BEFORE UPDATE OR DELETE ON "stock_movements" FOR EACH ROW EXECUTE FUNCTION oryvia_reject_ledger_mutation();
CREATE TRIGGER loyalty_ledger_append_only BEFORE UPDATE OR DELETE ON "loyalty_ledger" FOR EACH ROW EXECUTE FUNCTION oryvia_reject_ledger_mutation();
CREATE TRIGGER audit_events_append_only BEFORE UPDATE OR DELETE ON "audit_events" FOR EACH ROW EXECUTE FUNCTION oryvia_reject_ledger_mutation();
-- Commission ledger: amounts immutable; only settlement linkage may be set once.
CREATE OR REPLACE FUNCTION oryvia_commission_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'commission_ledger is append-only'; END IF;
  IF NEW."signedAmountPaise" <> OLD."signedAmountPaise" OR NEW."orderLineId" <> OLD."orderLineId" OR NEW."eventKey" <> OLD."eventKey" OR NEW."accountId" <> OLD."accountId"
     OR (OLD."settlementId" IS NOT NULL AND NEW."settlementId" IS DISTINCT FROM OLD."settlementId") THEN
    RAISE EXCEPTION 'commission_ledger entries are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER commission_ledger_guard BEFORE UPDATE OR DELETE ON "commission_ledger" FOR EACH ROW EXECUTE FUNCTION oryvia_commission_guard();

-- Search: trigram index for catalogue name search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "products_name_trgm" ON "products" USING gin ("name" gin_trgm_ops);
