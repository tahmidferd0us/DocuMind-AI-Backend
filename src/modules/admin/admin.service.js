import axios from 'axios';
import { AppError } from '../../core/errors/AppError.js';
import { env } from '../../config/env.js';
import { prisma } from '../../config/database.js';
import * as repository from './admin.repository.js';

export const getAnalytics = async () => {
  const stats = await repository.getPlatformStats();

  // Check NLP service health
  let nlpStatus = 'unknown';
  try {
    const res = await axios.get(`${env.NLP_SERVICE_URL}/health`, { timeout: 3000 });
    nlpStatus = res.status === 200 ? 'online' : 'degraded';
  } catch {
    nlpStatus = 'offline';
  }

  // Check Database health
  let dbStatus = 'healthy';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = 'unreachable';
  }

  const memory = process.memoryUsage();

  const system = {
    nodeEnv: env.NODE_ENV,
    nodeVersion: process.version,
    platform: process.platform,
    uptimeSeconds: Math.floor(process.uptime()),
    memory: {
      rssBytes: memory.rss,
      heapTotalBytes: memory.heapTotal,
      heapUsedBytes: memory.heapUsed,
    },
    services: {
      database: dbStatus,
      nlpService: {
        url: env.NLP_SERVICE_URL,
        status: nlpStatus,
      },
    },
  };

  return {
    ...stats,
    system,
  };
};

export const listUsers = async (params) => {
  return repository.findUsers(params);
};

export const updateUserStatus = async (currentUserId, targetUserId, { isActive }) => {
  if (currentUserId === targetUserId && !isActive) {
    throw AppError.badRequest('You cannot deactivate your own administrative account.');
  }

  const user = await repository.findUserById(targetUserId);
  if (!user) {
    throw AppError.notFound('User not found.');
  }

  return repository.updateUser(targetUserId, { isActive });
};

export const updateUserRole = async (currentUserId, targetUserId, { role }) => {
  const user = await repository.findUserById(targetUserId);
  if (!user) {
    throw AppError.notFound('User not found.');
  }

  if (currentUserId === targetUserId && role !== 'ADMIN') {
    const adminCount = await repository.countActiveAdmins();
    if (adminCount <= 1) {
      throw AppError.badRequest('Cannot demote yourself: at least one active administrator is required.');
    }
  }

  return repository.updateUser(targetUserId, { role });
};

export const listDocuments = async (params) => {
  return repository.findDocuments(params);
};

export const deleteDocument = async (id) => {
  try {
    return await repository.deleteDocumentById(id);
  } catch (error) {
    if (error.code === 'P2025') {
      throw AppError.notFound('Document not found.');
    }
    throw error;
  }
};
