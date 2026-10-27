import { logger } from './logger.js';
import { deleteExpiredSessions } from '../../modules/auth/auth.repository.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const runCleanup = async () => {
  try {
    const result = await deleteExpiredSessions();
    const count = result?.count ?? 0;
    if (count > 0) {
      logger.info(`Housekeeping: Purged ${count} expired sessions`);
    }
    return { count };
  } catch (error) {
    logger.error('Housekeeping: Failed to delete expired sessions', { message: error?.message });
    return { count: 0, error };
  }
};

export const startHousekeepingJobs = (intervalMs = ONE_DAY_MS) => {
  const initialTimer = setTimeout(() => {
    runCleanup().catch(() => {});
  }, 5000);
  initialTimer.unref();

  const intervalId = setInterval(() => {
    runCleanup().catch(() => {});
  }, intervalMs);
  intervalId.unref();

  return {
    stop: () => {
      clearTimeout(initialTimer);
      clearInterval(intervalId);
    },
    runNow: runCleanup,
  };
};
