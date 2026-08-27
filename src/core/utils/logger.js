import { env } from '../../config/env.js';

const stamp = () => new Date().toISOString();
const write = (level, message, meta) => console[level === 'debug' ? 'log' : level](`[${stamp()}] ${level.toUpperCase()} ${message}`, meta ?? '');

export const logger = {
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
  debug: (message, meta) => { if (!env.isProduction) write('debug', message, meta); },
};
