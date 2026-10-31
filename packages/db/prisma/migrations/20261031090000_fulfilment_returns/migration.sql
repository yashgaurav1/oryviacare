-- AlterTable
ALTER TABLE "refunds" ADD COLUMN     "coverage" JSONB,
ADD COLUMN     "returnRequestId" TEXT;

-- AlterTable
ALTER TABLE "return_lines" ADD COLUMN     "batchId" TEXT,
ADD COLUMN     "dispositionNote" TEXT,
ADD COLUMN     "warehouseId" TEXT,
ALTER COLUMN "disposition" SET DEFAULT 'pending';

-- AlterTable
ALTER TABLE "return_requests" ADD COLUMN     "decisionNote" TEXT,
ADD COLUMN     "reference" TEXT NOT NULL,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "warehouses" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'sellable';

-- CreateIndex
CREATE INDEX "refunds_paymentAttemptId_idx" ON "refunds"("paymentAttemptId");

-- CreateIndex
CREATE UNIQUE INDEX "return_requests_reference_key" ON "return_requests"("reference");

-- CreateIndex
CREATE INDEX "return_requests_orderId_idx" ON "return_requests"("orderId");

-- CreateIndex
CREATE INDEX "return_requests_status_createdAt_idx" ON "return_requests"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "return_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Invariants for fulfilment, returns and refunds (hand-written)
ALTER TABLE "fulfilment_lines" ADD CONSTRAINT "fulfilment_lines_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "return_lines" ADD CONSTRAINT "return_lines_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "return_lines" ADD CONSTRAINT "return_lines_disposition_valid" CHECK ("disposition" IN ('pending', 'quarantine', 'restocked', 'disposed', 'not_received'));
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_amount_positive" CHECK ("amountPaise" > 0);
ALTER TABLE "fulfilments" ADD CONSTRAINT "fulfilments_status_valid" CHECK ("status" IN ('packing', 'shipped', 'delivered', 'cancelled'));
ALTER TABLE "fulfilments" ALTER COLUMN "status" SET DEFAULT 'packing';
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_kind_valid" CHECK ("kind" IN ('sellable', 'quarantine'));
