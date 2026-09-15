import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';

/**
 * Email delivery for the password-reset OTP.
 *
 * Two channels are supported:
 *   1. An HTTP email API (Brevo / Resend) — preferred in production, because
 *      hosts such as Railway block outbound SMTP ports entirely (connection
 *      ETIMEDOUT / ESOCKET on both 587 and 465).
 *   2. Plain SMTP — works anywhere the ports are open, e.g. when running the
 *      API on your own machine or a VPS.
 *
 * Email is optional. The rest of the app runs fine without it; only the
 * "forgot password" flow needs it and reports that clearly when it is missing.
 */
export const isMailConfigured = (): boolean =>
  Boolean(env.EMAIL_API_KEY) || Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  }
  return transporter;
}

async function sendViaHttpApi(params: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const { to, subject, text, html } = params;
  const provider = (env.EMAIL_API_PROVIDER || 'brevo').toLowerCase();
  const fromEmail = env.SMTP_USER || to;
  const fromName = env.SMTP_FROM_NAME || 'POS';

  let url: string;
  let headers: Record<string, string>;
  let body: unknown;

  if (provider === 'resend') {
    url = 'https://api.resend.com/emails';
    headers = { Authorization: `Bearer ${env.EMAIL_API_KEY}`, 'Content-Type': 'application/json' };
    body = { from: `${fromName} <${fromEmail}>`, to: [to], subject, text, html };
  } else if (provider === 'brevo') {
    url = 'https://api.brevo.com/v3/smtp/email';
    headers = { 'api-key': env.EMAIL_API_KEY!, 'Content-Type': 'application/json' };
    body = {
      sender: { email: fromEmail, name: fromName },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    };
  } else {
    throw new Error(`Unsupported EMAIL_API_PROVIDER "${provider}" (use "brevo" or "resend")`);
  }

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`${provider} email API responded ${res.status}: ${detail.slice(0, 300)}`);
  }
}

export async function sendPasswordResetOtp(params: {
  to: string;
  otp: string;
  fullName: string;
  shopName: string;
  minutes: number;
}): Promise<void> {
  const { to, otp, fullName, shopName, minutes } = params;

  const subject = `${otp} is your ${shopName} password reset code`;

  const text = [
    `Hello ${fullName},`,
    '',
    `Your password reset code for ${shopName} is: ${otp}`,
    '',
    `This code expires in ${minutes} minutes and can be used once.`,
    'If you did not ask for a password reset, you can ignore this email —',
    'your current password will keep working.',
    '',
    `— ${shopName}`,
  ].join('\n');

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
      <div style="background:#0f9aa8;padding:16px 24px">
        <div style="color:#ffffff;font-size:16px;font-weight:700">${shopName}</div>
      </div>
      <div style="padding:24px">
        <p style="margin:0 0 16px">Hello ${fullName},</p>
        <p style="margin:0 0 16px">Use this code to set a new password:</p>
        <div style="font-size:32px;font-weight:800;letter-spacing:8px;text-align:center;padding:16px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;color:#0f172a">${otp}</div>
        <p style="margin:16px 0 0;font-size:13px;color:#475569">
          The code expires in ${minutes} minutes and works only once. If you did not
          ask for a password reset you can ignore this email — your current password
          stays the same.
        </p>
      </div>
      <div style="padding:14px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8">
        Sent automatically by ${shopName} POS. Please do not reply.
      </div>
    </div>
  </body>
</html>`;

  if (env.EMAIL_API_KEY) {
    await sendViaHttpApi({ to, subject, text, html });
    return;
  }

  await getTransporter().sendMail({
    from: env.SMTP_FROM || env.SMTP_USER!,
    to,
    subject,
    text,
    html,
  });
}
