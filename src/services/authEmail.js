import { env } from '../config/env.js';
import { logger } from '../core/utils/logger.js';

export const sendAuthEmail = async ({ to, subject, action, token }) => {
  const link = new URL(`/${action}`, env.FRONTEND_URL);
  link.searchParams.set('token', token);
  if (!env.RESEND_API_KEY) {
    if (env.isProduction) throw new Error('RESEND_API_KEY is required to deliver account security emails');
    logger.warn(`Auth email delivery is not configured; ${action} link for ${to}: ${link}`);
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.AUTH_EMAIL_FROM,
      to: [to],
      subject,
      html: `<p>Use this link to continue:</p><p><a href="${link}">${subject}</a></p><p>This link expires soon. If you did not request this, you can ignore this email.</p>`,
    }),
  });
  if (!response.ok) throw new Error(`Auth email delivery failed (${response.status})`);
};
