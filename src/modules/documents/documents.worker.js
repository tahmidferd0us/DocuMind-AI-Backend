import { logger } from '../../core/utils/logger.js';
import * as repository from './documents.repository.js';
import { processDocument } from './documents.service.js';

const POLL_INTERVAL_MS = 2000;
const STALE_AFTER_MS = 15 * 60 * 1000;

export const startDocumentWorker = () => {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const staleBefore = new Date(Date.now() - STALE_AFTER_MS);
      await repository.failExhaustedStaleDocuments(staleBefore);
      await repository.claimStaleDocuments(staleBefore);
      const next = await repository.findNextQueuedDocument();
      if (next) await processDocument(next.id);
    } catch (error) {
      logger.error('Document worker poll failed', { code: error?.code ?? 'WORKER_ERROR' });
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => run().catch(() => {}), POLL_INTERVAL_MS);
  timer.unref();
  run().catch(() => {});
  return { stop: () => clearInterval(timer) };
};
