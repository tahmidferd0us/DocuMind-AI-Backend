import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env.js';
import { buildModuleRouter } from './modules/index.js';
import { errorHandler } from './core/middleware/errorHandler.js';
import { notFound } from './core/middleware/notFound.js';
import { globalLimiter } from './core/middleware/rateLimiters.js';

export const API_PREFIX = '/api/v1';

const corsOptions = {
  origin: (origin, callback) => callback(null, !origin || env.corsOrigins.includes(origin)),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

export const createApp = () => {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors(corsOptions));
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());
  if (!env.isProduction) app.use(morgan('dev'));
  app.use(globalLimiter);

  app.use(API_PREFIX, buildModuleRouter());

  app.use(notFound);
  app.use(errorHandler);

  return app;
};
