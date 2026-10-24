-- CreateTable
CREATE TABLE "UaePassSignInTicket" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UaePassSignInTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UaePassSignInTicket_tokenHash_key" ON "UaePassSignInTicket"("tokenHash");

-- CreateIndex
CREATE INDEX "UaePassSignInTicket_customerId_idx" ON "UaePassSignInTicket"("customerId");

-- CreateIndex
CREATE INDEX "UaePassSignInTicket_expiresAt_idx" ON "UaePassSignInTicket"("expiresAt");

-- AddForeignKey
ALTER TABLE "UaePassSignInTicket" ADD CONSTRAINT "UaePassSignInTicket_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
