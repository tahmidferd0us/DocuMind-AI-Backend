ALTER TABLE "documents"
  ADD COLUMN "processingStep" TEXT,
  ADD COLUMN "progress" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "processingStartedAt" TIMESTAMP(3),
  ADD COLUMN "sourceFile" BYTEA;

CREATE INDEX "documents_status_processingStartedAt_idx" ON "documents"("status", "processingStartedAt");

UPDATE "documents" SET "progress" = 100, "processingStep" = 'Complete' WHERE "status" = 'READY';
UPDATE "documents" SET "status" = 'FAILED', "processingStep" = 'Failed', "errorMessage" = 'This processing job predates durable uploads. Upload the document again to process it.' WHERE "status" = 'PROCESSING';
