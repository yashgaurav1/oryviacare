/*
  Warnings:

  - Added the required column `balanceId` to the `stock_reservations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "stock_reservations" ADD COLUMN     "balanceId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_balanceId_fkey" FOREIGN KEY ("balanceId") REFERENCES "stock_balances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
