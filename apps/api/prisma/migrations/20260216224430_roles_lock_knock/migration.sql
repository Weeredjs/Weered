/*
  Warnings:

  - You are about to drop the column `ownerUserId` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `privacyMode` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `roomType` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `spaceId` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the `Knock` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Membership` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Message` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RoomState` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Space` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Knock" DROP CONSTRAINT "Knock_fromUserId_fkey";

-- DropForeignKey
ALTER TABLE "Knock" DROP CONSTRAINT "Knock_toUserId_fkey";

-- DropForeignKey
ALTER TABLE "Membership" DROP CONSTRAINT "Membership_spaceId_fkey";

-- DropForeignKey
ALTER TABLE "Membership" DROP CONSTRAINT "Membership_userId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_fromUserId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_roomId_fkey";

-- DropForeignKey
ALTER TABLE "Room" DROP CONSTRAINT "Room_spaceId_fkey";

-- DropForeignKey
ALTER TABLE "RoomState" DROP CONSTRAINT "RoomState_roomId_fkey";

-- DropForeignKey
ALTER TABLE "Space" DROP CONSTRAINT "Space_ownerUserId_fkey";

-- AlterTable
ALTER TABLE "Room" DROP COLUMN "ownerUserId",
DROP COLUMN "privacyMode",
DROP COLUMN "roomType",
DROP COLUMN "spaceId",
ADD COLUMN     "locked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "ownerName" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "name" DROP NOT NULL;

-- DropTable
DROP TABLE "Knock";

-- DropTable
DROP TABLE "Membership";

-- DropTable
DROP TABLE "Message";

-- DropTable
DROP TABLE "RoomState";

-- DropTable
DROP TABLE "Space";

-- DropTable
DROP TABLE "User";

-- DropEnum
DROP TYPE "GlobalRole";

-- DropEnum
DROP TYPE "KnockStatus";

-- DropEnum
DROP TYPE "MessageScope";

-- DropEnum
DROP TYPE "PrivacyMode";

-- DropEnum
DROP TYPE "RoomType";

-- DropEnum
DROP TYPE "SpaceRole";

-- DropEnum
DROP TYPE "SpaceType";

-- DropEnum
DROP TYPE "SubscriptionTier";

-- CreateTable
CREATE TABLE "RoomMember" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomKnock" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomKnock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "fromId" TEXT,
    "fromName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoomMember_roomId_role_idx" ON "RoomMember"("roomId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "RoomMember_roomId_userId_key" ON "RoomMember"("roomId", "userId");

-- CreateIndex
CREATE INDEX "RoomKnock_roomId_createdAt_idx" ON "RoomKnock"("roomId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RoomKnock_roomId_userId_key" ON "RoomKnock"("roomId", "userId");

-- CreateIndex
CREATE INDEX "ChatMessage_roomId_createdAt_idx" ON "ChatMessage"("roomId", "createdAt");

-- AddForeignKey
ALTER TABLE "RoomMember" ADD CONSTRAINT "RoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomKnock" ADD CONSTRAINT "RoomKnock_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
