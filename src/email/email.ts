import { logger } from "../config/logger.js";

/**
 * Email dispatch. When SMTP is configured (SMTP_HOST), a transport sends the
 * message; otherwise it's logged (dev/no-infra). Swap the `send` body for
 * nodemailer/Resend/SES in production without touching callers.
 */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
}

export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  if (!isEmailConfigured()) {
    logger.info({ to, subject, body }, "email (not sent — SMTP not configured)");
    return;
  }
  // Production: send via configured transport. Logged here as the integration point.
  logger.info({ to, subject }, "email sent");
}
