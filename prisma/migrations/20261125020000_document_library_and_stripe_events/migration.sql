ALTER TABLE "documents" ADD COLUMN "displayName" TEXT, ADD COLUMN "folder" TEXT, ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], ADD COLUMN "storagePath" TEXT;
CREATE TABLE "stripe_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "resourceId" TEXT,
    "stripeCreated" INTEGER NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stripe_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "stripe_events_resourceId_stripeCreated_idx" ON "stripe_events"("resourceId", "stripeCreated");
