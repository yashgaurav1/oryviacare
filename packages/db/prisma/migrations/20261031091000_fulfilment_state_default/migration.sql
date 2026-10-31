-- Fulfilment state is now derived from shipments; "unallocated" is renamed "unfulfilled".
ALTER TABLE "orders" ALTER COLUMN "fulfilmentState" SET DEFAULT 'unfulfilled';
UPDATE "orders" SET "fulfilmentState" = 'unfulfilled' WHERE "fulfilmentState" = 'unallocated';
