-- CreateTable
CREATE TABLE "RoomBan" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT,
    "reason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomBan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoomBan_roomId_idx" ON "RoomBan"("roomId");

-- CreateIndex
CREATE INDEX "RoomBan_userId_idx" ON "RoomBan"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomBan_roomId_userId_key" ON "RoomBan"("roomId", "userId");
