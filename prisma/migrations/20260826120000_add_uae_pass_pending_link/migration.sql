-- CreateTable
CREATE TABLE "UaePassPendingLink" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "uaePassUuid" TEXT NOT NULL,
    "email" TEXT,
    "fullnameEN" TEXT,
    "firstnameEN" TEXT,
    "lastnameEN" TEXT,
    "nationalityEN" TEXT,
    "userType" TEXT NOT NULL,
    "idnPresent" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT NOT NULL,
    "callbackUrl" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UaePassPendingLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UaePassPendingLink_tokenHash_key" ON "UaePassPendingLink"("tokenHash");

-- CreateIndex
CREATE INDEX "UaePassPendingLink_expiresAt_idx" ON "UaePassPendingLink"("expiresAt");

-- CreateIndex
CREATE INDEX "UaePassPendingLink_uaePassUuid_idx" ON "UaePassPendingLink"("uaePassUuid");
