import { prisma } from '../../config/database.js';

export const getPlatformStats = async () => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    activeUsers,
    adminUsers,
    recentUsersCount,
    totalDocuments,
    statusGroups,
    docAggregates,
    mimeGroups,
    totalSummaries,
    totalQaMessages,
    totalEntitySets,
    recentDocuments,
    recentUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),

    prisma.document.count(),
    prisma.document.groupBy({
      by: ['status'],
      _count: { status: true },
    }),
    prisma.document.aggregate({
      _sum: {
        sizeBytes: true,
        wordCount: true,
        pageCount: true,
      },
    }),
    prisma.document.groupBy({
      by: ['mimeType'],
      _count: { mimeType: true },
    }),

    prisma.summary.count(),
    prisma.qaMessage.count(),
    prisma.entitySet.count(),

    prisma.document.findMany({
      take: 6,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        sizeBytes: true,
        status: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    }),
    prisma.user.findMany({
      take: 6,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
    }),
  ]);

  const byStatus = {
    ready: 0,
    processing: 0,
    failed: 0,
  };
  for (const group of statusGroups) {
    const key = group.status.toLowerCase();
    if (key in byStatus) {
      byStatus[key] = group._count.status;
    }
  }

  const byMimeType = mimeGroups.map((g) => ({
    mimeType: g.mimeType,
    count: g._count.mimeType,
  }));

  return {
    users: {
      total: totalUsers,
      active: activeUsers,
      inactive: totalUsers - activeUsers,
      admins: adminUsers,
      recentSignups: recentUsersCount,
    },
    documents: {
      total: totalDocuments,
      byStatus,
      totalSizeBytes: docAggregates._sum.sizeBytes || 0,
      totalWords: docAggregates._sum.wordCount || 0,
      totalPages: docAggregates._sum.pageCount || 0,
      byMimeType,
    },
    ai: {
      totalSummaries,
      totalQaMessages,
      totalEntitySets,
    },
    recentActivity: {
      recentDocuments,
      recentUsers,
    },
  };
};

export const findUsers = async ({ page = 1, limit = 10, search, role, status }) => {
  const where = {};

  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { fullName: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (role) {
    where.role = role;
  }

  if (status === 'active') {
    where.isActive = true;
  } else if (status === 'inactive') {
    where.isActive = false;
  }

  const [total, items] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            documents: true,
          },
        },
      },
    }),
  ]);

  return { total, items };
};

export const findUserById = (id) =>
  prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

export const updateUser = (id, data) =>
  prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

export const countActiveAdmins = () =>
  prisma.user.count({
    where: {
      role: 'ADMIN',
      isActive: true,
    },
  });

export const findDocuments = async ({ page = 1, limit = 10, search, status }) => {
  const where = {};

  if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { filename: { contains: search, mode: 'insensitive' } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.document.count({ where }),
    prisma.document.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        sizeBytes: true,
        status: true,
        errorMessage: true,
        pageCount: true,
        wordCount: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    }),
  ]);

  return { total, items };
};

export const deleteDocumentById = (id) =>
  prisma.document.delete({
    where: { id },
  });
