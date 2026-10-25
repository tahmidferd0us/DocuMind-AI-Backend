import http from 'node:http';
import { createApp, API_PREFIX } from '../../src/app.js';
import { prisma } from '../../src/config/database.js';
import { signAccessToken } from '../../src/modules/auth/auth.tokens.js';

export const startTestServer = async () => {
  const app = createApp();
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}${API_PREFIX}`;

  const request = async (endpoint, options = {}) => {
    const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;
    const headers = { ...options.headers };

    if (options.token) {
      headers.Authorization = `Bearer ${options.token}`;
    }

    if (options.json !== undefined) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.json);
    }

    const res = await fetch(url, {
      ...options,
      headers,
    });

    let data = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }

    return {
      status: res.status,
      headers: res.headers,
      data,
    };
  };

  const close = async () => {
    await new Promise((resolve) => server.close(resolve));
  };

  return { server, baseUrl, request, close };
};

export const createTestUser = async ({ email, role = 'USER', isActive = true, fullName = 'Test User' }) => {
  const user = await prisma.user.upsert({
    where: { email },
    update: { role, isActive, fullName },
    create: {
      email,
      fullName,
      role,
      isActive,
      passwordHash: '$2a$12$e8Y6lP6xY4J1a/0jN9r5xOC/qB4nO6ZfO3uXgJt2a/H0cR4vF1N4W', // precomputed hash for "Password123!"
    },
  });
  const token = signAccessToken(user);
  return { user, token };
};

export const cleanupTestUser = async (email) => {
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.document.deleteMany({ where: { userId: user.id } });
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  } catch (err) {
    // Ignore cleanup errors
  }
};
