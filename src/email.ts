import nodemailer from 'nodemailer';

// Lazy-initialized SMTP transporter so this module is safe to import in
// environments without SMTP env vars set (e.g. Vercel preview builds, CI).
// Throws on first use if any of the required vars is missing.
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      'SMTP not configured — set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM in .env'
    );
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    // Port 465 is implicit TLS; 587 starts plaintext and upgrades via STARTTLS.
    secure: port === 465,
    auth: { user, pass },
  });
  return transporter;
}

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

/**
 * Send a transactional email through the configured SMTP server.
 * Throws on error so the caller can decide whether to retry, log, or swallow.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from) throw new Error('SMTP_FROM (or SMTP_USER) is required');

  await getTransporter().sendMail({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo,
  });
}
