-- Unapproved package versions store only the observed quantity; paid/free split is decided at approval.
ALTER TABLE "package_components" DROP CONSTRAINT "package_components_qty";
ALTER TABLE "package_components" ADD CONSTRAINT "package_components_qty" CHECK ("paidQty" >= 0 AND "freeQty" >= 0 AND (("paidQty" + "freeQty") > 0 OR "observedQty" > 0));
