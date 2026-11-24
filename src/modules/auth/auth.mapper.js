export const toPublicUser = (user) => ({
  id: user.id,
  email: user.email,
  emailVerifiedAt: user.emailVerifiedAt ?? null,
  fullName: user.fullName,
  role: user.role,
  isActive: user.isActive,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

