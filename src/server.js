import { createApp, API_PREFIX } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { logger } from './core/utils/logger.js';

const start = async () => {
  try {
    await connectDatabase();
    logger.info('Database connection established');
  } catch (error) {
    logger.warn('Database unreachable at startup, continuing to boot', { message: error?.message });
  }

  const server = createApp().listen(env.PORT, () => logger.info(`DocuMind AI API listening on http://localhost:${env.PORT}${API_PREFIX}`));

  const shutdown = async (signal) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => { await disconnectDatabase(); process.exit(0); });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => logger.error('Unhandled promise rejection', { reason }));
};

start();
