-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "pages" JSONB;

-- CreateTable
CREATE TABLE "qa_messages" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sources" JSONB,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qa_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "qa_messages_documentId_createdAt_idx" ON "qa_messages"("documentId", "createdAt");

-- AddForeignKey
ALTER TABLE "qa_messages" ADD CONSTRAINT "qa_messages_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
