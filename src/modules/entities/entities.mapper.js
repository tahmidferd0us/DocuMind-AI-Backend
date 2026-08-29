export const toPublicEntitySet = (entitySet) => ({
  documentId: entitySet.documentId,
  entities: entitySet.entities,
  keywords: entitySet.keywords,
  totalFound: entitySet.totalFound,
  createdAt: entitySet.createdAt,
  updatedAt: entitySet.updatedAt,
});
