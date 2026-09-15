import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';

let transporter: Transporter | null = null;

/**
 * Email is optional. The rest of the app runs fine without it; only the
 * "forgot password" OTP flow needs it, and that endpoint reports a clear error
 * when it is not configured rather than failing silently.
 */
export const isMailConfigured = (): boolean =>
  Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

export async function sendPasswordResetOtp(params: {
  to: string;
  otp: string;
  fullName: string;
  shopName: string;
  minutes: number;
}): Promise<void> {
  const { to, otp, fullName, shopName, minutes } = params;
  const from = env.SMTP_FROM || env.SMTP_USER!;

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

  await getTransporter().sendMail({ from, to, subject, text, html });
}
