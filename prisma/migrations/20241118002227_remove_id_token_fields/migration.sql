/*
  Warnings:

  - You are about to drop the column `idToken` on the `Token` table. All the data in the column will be lost.
  - You are about to drop the column `idTokenExpiration` on the `Token` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Token" DROP COLUMN "idToken",
DROP COLUMN "idTokenExpiration";
