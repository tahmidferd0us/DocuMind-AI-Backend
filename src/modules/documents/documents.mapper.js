export const toPublicDocument = (document) => ({
  id: document.id,
  filename: document.filename,
  mimeType: document.mimeType,
  sizeBytes: document.sizeBytes,
  status: document.status,
  errorMessage: document.errorMessage ?? null,
  pageCount: document.pageCount ?? null,
  wordCount: document.wordCount ?? null,
  charCount: document.charCount ?? null,
  createdAt: document.createdAt,
});
