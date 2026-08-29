-- CreateTable
CREATE TABLE "entity_sets" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "entities" JSONB NOT NULL,
    "keywords" JSONB NOT NULL,
    "totalFound" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entity_sets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "entity_sets_documentId_key" ON "entity_sets"("documentId");

-- AddForeignKey
ALTER TABLE "entity_sets" ADD CONSTRAINT "entity_sets_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
