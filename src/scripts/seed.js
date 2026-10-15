import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma, disconnectDatabase } from '../config/database.js';
import { logger } from '../core/utils/logger.js';

const SEED_ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@documind.ai';
const SEED_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminPassword123!';
const SEED_ADMIN_NAME = process.env.ADMIN_NAME || 'DocuMind Super Admin';
const SALT_ROUNDS = 12;

export const seedSuperAdmin = async () => {
  logger.info('Starting super admin database seeding...');

  const passwordHash = await bcrypt.hash(SEED_ADMIN_PASSWORD, SALT_ROUNDS);

  const existingUser = await prisma.user.findUnique({
    where: { email: SEED_ADMIN_EMAIL.toLowerCase() },
  });

  let adminUser;
  if (existingUser) {
    adminUser = await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        role: 'ADMIN',
        isActive: true,
        fullName: SEED_ADMIN_NAME,
        passwordHash,
      },
    });
    logger.info(`Updated existing user ${SEED_ADMIN_EMAIL} to SUPER ADMIN (ADMIN role).`);
  } else {
    adminUser = await prisma.user.create({
      data: {
        email: SEED_ADMIN_EMAIL.toLowerCase(),
        fullName: SEED_ADMIN_NAME,
        role: 'ADMIN',
        isActive: true,
        passwordHash,
      },
    });
    logger.info(`Created new SUPER ADMIN user: ${SEED_ADMIN_EMAIL}`);
  }

  logger.info('-----------------------------------------');
  logger.info(' Super Admin Seed Completed Successfully');
  logger.info(` Email:    ${SEED_ADMIN_EMAIL}`);
  logger.info(` Password: ${SEED_ADMIN_PASSWORD}`);
  logger.info(` Role:     ${adminUser.role}`);
  logger.info(` ID:       ${adminUser.id}`);
  logger.info('-----------------------------------------');

  return adminUser;
};

// Execute if run directly
if (process.argv[1]?.endsWith('seed.js')) {
  seedSuperAdmin()
    .then(async () => {
      await disconnectDatabase();
      process.exit(0);
    })
    .catch(async (error) => {
      logger.error('Failed to seed super admin:', { error: error.message, stack: error.stack });
      await disconnectDatabase();
      process.exit(1);
    });
}
