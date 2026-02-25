-- CreateTable
CREATE TABLE "LocalAuth" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalAuth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LocalAuth_username_key" ON "LocalAuth"("username");

-- CreateIndex
CREATE UNIQUE INDEX "LocalAuth_userId_key" ON "LocalAuth"("userId");

-- AddForeignKey
ALTER TABLE "LocalAuth" ADD CONSTRAINT "LocalAuth_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
