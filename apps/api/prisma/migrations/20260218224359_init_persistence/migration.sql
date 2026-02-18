/*
  Warnings:

  - You are about to drop the column `createdBy` on the `RoomBan` table. All the data in the column will be lost.
  - You are about to drop the column `reason` on the `RoomBan` table. All the data in the column will be lost.
  - You are about to drop the column `userName` on the `RoomBan` table. All the data in the column will be lost.
  - The primary key for the `RoomMember` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `role` column on the `RoomMember` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `Message` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[roomId,userId]` on the table `RoomMember` will be added. If there are existing duplicate values, this will fail.
  - Made the column `name` on table `Room` required. This step will fail if there are existing NULL values in that column.
  - The required column `id` was added to the `RoomMember` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- CreateEnum
CREATE TYPE "RoomRole" AS ENUM ('OWNER', 'MOD', 'MEMBER');

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_roomId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_userId_fkey";

-- DropForeignKey
ALTER TABLE "Room" DROP CONSTRAINT "Room_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "RoomMember" DROP CONSTRAINT "RoomMember_userId_fkey";

-- DropIndex
DROP INDEX "RoomBan_roomId_idx";

-- DropIndex
DROP INDEX "RoomBan_userId_idx";

-- DropIndex
DROP INDEX "RoomMember_userId_idx";

-- AlterTable
ALTER TABLE "Room" ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "name" SET DEFAULT '',
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RoomBan" DROP COLUMN "createdBy",
DROP COLUMN "reason",
DROP COLUMN "userName";

-- AlterTable
ALTER TABLE "RoomMember" DROP CONSTRAINT "RoomMember_pkey",
ADD COLUMN     "id" TEXT NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL DEFAULT '',
DROP COLUMN "role",
ADD COLUMN     "role" "RoomRole" NOT NULL DEFAULT 'MEMBER',
ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "RoomMember_pkey" PRIMARY KEY ("id");

-- DropTable
DROP TABLE "Message";

-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "RoomMessage" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomAudit" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "targetId" TEXT,
    "note" TEXT,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoomMessage_roomId_ts_idx" ON "RoomMessage"("roomId", "ts");

-- CreateIndex
CREATE INDEX "RoomAudit_roomId_ts_idx" ON "RoomAudit"("roomId", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "RoomMember_roomId_userId_key" ON "RoomMember"("roomId", "userId");

-- AddForeignKey
ALTER TABLE "RoomBan" ADD CONSTRAINT "RoomBan_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomMessage" ADD CONSTRAINT "RoomMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomAudit" ADD CONSTRAINT "RoomAudit_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
