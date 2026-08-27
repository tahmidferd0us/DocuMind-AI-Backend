import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/index.js';
import { env } from './env.js';

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter, log: env.isProduction ? ['error'] : ['warn', 'error'] });

export const connectDatabase = async () => { await prisma.$queryRaw`SELECT 1`; };

export const disconnectDatabase = async () => { await prisma.$disconnect(); };
