/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `LocalAuth` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[verifyToken]` on the table `LocalAuth` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[lobbyId,name]` on the table `Room` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "LobbyRole" AS ENUM ('OWNER', 'MOD', 'MEMBER');

-- CreateEnum
CREATE TYPE "GlobalRole" AS ENUM ('USER', 'SUPPORT', 'STAFF', 'ADMIN', 'GOD');

-- CreateEnum
CREATE TYPE "ModuleType" AS ENUM ('REDDIT', 'BUNGIE', 'TWITCH', 'YOUTUBE', 'CUSTOM', 'NONE');

-- CreateEnum
CREATE TYPE "UserTier" AS ENUM ('INNOCENT', 'INDICTED', 'FELON', 'KINGPIN');

-- AlterTable
ALTER TABLE "LocalAuth" ADD COLUMN     "email" TEXT,
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verifyToken" TEXT,
ADD COLUMN     "verifyTokenExp" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "lobbyId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "globalRole" "GlobalRole" NOT NULL DEFAULT 'USER',
ADD COLUMN     "notoriety" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tier" "UserTier" NOT NULL DEFAULT 'INNOCENT';

-- CreateTable
CREATE TABLE "Lobby" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "moduleType" "ModuleType" NOT NULL DEFAULT 'REDDIT',
    "moduleConfig" JSONB,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lobby_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LobbyMember" (
    "id" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "role" "LobbyRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LobbyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LobbyBan" (
    "id" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LobbyBan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LobbyMessage" (
    "id" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LobbyMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LobbyAudit" (
    "id" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "targetId" TEXT,
    "note" TEXT,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LobbyAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffNote" (
    "id" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalAudit" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL DEFAULT '',
    "action" TEXT NOT NULL,
    "targetId" TEXT,
    "targetName" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlobalAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotorietyEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotorietyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LobbyMember_lobbyId_userId_key" ON "LobbyMember"("lobbyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "LobbyBan_lobbyId_userId_key" ON "LobbyBan"("lobbyId", "userId");

-- CreateIndex
CREATE INDEX "LobbyMessage_lobbyId_ts_idx" ON "LobbyMessage"("lobbyId", "ts");

-- CreateIndex
CREATE INDEX "LobbyAudit_lobbyId_ts_idx" ON "LobbyAudit"("lobbyId", "ts");

-- CreateIndex
CREATE INDEX "GlobalAudit_createdAt_idx" ON "GlobalAudit"("createdAt");

-- CreateIndex
CREATE INDEX "NotorietyEvent_userId_action_idx" ON "NotorietyEvent"("userId", "action");

-- CreateIndex
CREATE UNIQUE INDEX "LocalAuth_email_key" ON "LocalAuth"("email");

-- CreateIndex
CREATE UNIQUE INDEX "LocalAuth_verifyToken_key" ON "LocalAuth"("verifyToken");

-- CreateIndex
CREATE UNIQUE INDEX "Room_lobbyId_name_key" ON "Room"("lobbyId", "name");

-- AddForeignKey
ALTER TABLE "LobbyMember" ADD CONSTRAINT "LobbyMember_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LobbyBan" ADD CONSTRAINT "LobbyBan_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LobbyMessage" ADD CONSTRAINT "LobbyMessage_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LobbyAudit" ADD CONSTRAINT "LobbyAudit_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffNote" ADD CONSTRAINT "StaffNote_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalAudit" ADD CONSTRAINT "GlobalAudit_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotorietyEvent" ADD CONSTRAINT "NotorietyEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
