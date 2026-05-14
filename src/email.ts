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

// Default display name shown in the recipient's "From" field. Overridden if
// SMTP_FROM is already in `"Name" <email>` form, or by SMTP_FROM_NAME.
const DEFAULT_FROM_NAME = 'CRM Ecosistemas';

function resolveFrom(): string {
  const raw = (process.env.SMTP_FROM || process.env.SMTP_USER || '').trim();
  if (!raw) throw new Error('SMTP_FROM (or SMTP_USER) is required');
  // If the env var already includes a display name (e.g. `Name <a@b.c>`),
  // pass it through unchanged so the user's explicit choice wins.
  if (raw.includes('<') && raw.includes('>')) return raw;
  const name = process.env.SMTP_FROM_NAME?.trim() || DEFAULT_FROM_NAME;
  return `"${name}" <${raw}>`;
}

/**
 * Send a transactional email through the configured SMTP server.
 * Throws on error so the caller can decide whether to retry, log, or swallow.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  await getTransporter().sendMail({
    from: resolveFrom(),
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo,
  });
}
