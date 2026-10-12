-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "discountReserved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paidAtEstimated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reservationActive" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "deliveryType" TEXT,
ADD COLUMN     "productImage" TEXT,
ADD COLUMN     "productName" TEXT;

-- AlterTable
ALTER TABLE "DeliveryItem" ADD COLUMN     "orderItemId" TEXT,
ADD COLUMN     "stockId" TEXT;

-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'started',
    "requestKey" TEXT NOT NULL,
    "reference" TEXT,
    "expectedAmount" DECIMAL(12,2) NOT NULL,
    "receivedAmount" DECIMAL(12,2),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderAccessSession" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderAccessSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderAccessChallenge" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "OrderAccessChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationJob" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "dedupKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderAuditEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_requestKey_key" ON "PaymentAttempt"("requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_reference_key" ON "PaymentAttempt"("reference");

-- CreateIndex
CREATE INDEX "PaymentAttempt_orderId_status_idx" ON "PaymentAttempt"("orderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OrderAccessSession_tokenHash_key" ON "OrderAccessSession"("tokenHash");

-- CreateIndex
CREATE INDEX "OrderAccessSession_orderId_idx" ON "OrderAccessSession"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderAccessChallenge_tokenHash_key" ON "OrderAccessChallenge"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationJob_dedupKey_key" ON "NotificationJob"("dedupKey");

-- CreateIndex
CREATE INDEX "NotificationJob_status_nextAttemptAt_idx" ON "NotificationJob"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "OrderAuditEvent_orderId_createdAt_idx" ON "OrderAuditEvent"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");

-- CreateIndex
CREATE INDEX "Order_status_expiresAt_idx" ON "Order"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "Order_paidAt_idx" ON "Order"("paidAt");

-- CreateIndex
CREATE INDEX "Order_customerEmail_idx" ON "Order"("customerEmail");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryItem_stockId_key" ON "DeliveryItem"("stockId");

-- CreateIndex
CREATE INDEX "DeliveryItem_orderId_idx" ON "DeliveryItem"("orderId");

-- AddForeignKey
ALTER TABLE "DeliveryItem" ADD CONSTRAINT "DeliveryItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAccessSession" ADD CONSTRAINT "OrderAccessSession_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAccessChallenge" ADD CONSTRAINT "OrderAccessChallenge_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationJob" ADD CONSTRAINT "NotificationJob_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAuditEvent" ADD CONSTRAINT "OrderAuditEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- New commerce tables are server-only: never expose tokens, payment state or notifications.
-- This migration has NOT been applied to the shop. Old shop tables were secured separately.
ALTER TABLE "PaymentAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderAccessSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderAccessChallenge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderAuditEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RateLimitBucket" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "PaymentAttempt", "OrderAccessSession", "OrderAccessChallenge", "NotificationJob", "OrderAuditEvent", "RateLimitBucket" FROM PUBLIC;
DO $commerce_privileges$
DECLARE api_role text; table_name text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN
      FOREACH table_name IN ARRAY ARRAY['PaymentAttempt','OrderAccessSession','OrderAccessChallenge','NotificationJob','OrderAuditEvent','RateLimitBucket'] LOOP
        EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE %I FROM %I',table_name,api_role);
      END LOOP;
    END IF;
  END LOOP;
END
$commerce_privileges$;

-- Preserve existing rows. Snapshot legacy names from current catalog (historic names unavailable).
UPDATE "OrderItem" i SET "productName"=p."name", "productImage"=p."image", "deliveryType"=p."deliveryType" FROM "Product" p WHERE i."productId"=p."id";
UPDATE "Product" p SET "categoryId"=c."id" FROM "Category" c WHERE p."category"=c."slug" AND p."categoryId" IS NULL;
UPDATE "Order" SET "expiresAt"="createdAt" + INTERVAL '1 hour';
-- Legacy payment timestamps are estimates, never represented as verified provider timestamps.
UPDATE "Order" SET "paidAt"="updatedAt", "paidAtEstimated"=true WHERE "status" IN ('paid','completed','needs_manual_delivery');
-- Quarantine legacy pending orders that already hold SOLD keys. Never release or charge them again automatically.
UPDATE "Order" o SET "status"='payment_review' WHERE o."status"='pending' AND EXISTS (SELECT 1 FROM "DigitalStock" s WHERE s."orderId"=o."id" AND s."isSold"=true);
INSERT INTO "PaymentAttempt" ("id","orderId","method","status","requestKey","expectedAmount","note","createdAt","updatedAt")
SELECT 'legacy-'||"id", "id", 'legacy', 'review', 'legacy:'||"id", "total", 'Legacy sold stock on pending order: reconcile provider ledger before changing status', "createdAt", NOW() FROM "Order" WHERE "status"='payment_review';
