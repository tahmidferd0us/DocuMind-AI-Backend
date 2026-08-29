-- CreateTable
CREATE TABLE "summaries" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "extractive" TEXT NOT NULL,
    "abstractive" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "sentenceCount" INTEGER NOT NULL,
    "format" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "summaries_documentId_key" ON "summaries"("documentId");

-- AddForeignKey
ALTER TABLE "summaries" ADD CONSTRAINT "summaries_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
