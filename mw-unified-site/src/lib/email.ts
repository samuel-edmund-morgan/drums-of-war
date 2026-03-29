import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}
const FROM = process.env.EMAIL_FROM || "Drums of War <noreply@morgan-dev.com>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://world-of-warcraft.morgan-dev.com";

export async function sendVerificationEmail(
  to: string,
  username: string,
  token: string,
): Promise<boolean> {
  const verifyUrl = `${SITE_URL}/auth/verify?token=${token}`;

  try {
    const { error } = await getResend().emails.send({
      from: FROM,
      to,
      subject: "Verify your Drums of War account",
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; background: #141418; color: #e8e6e3; padding: 32px; border-radius: 12px;">
          <h1 style="color: #ffa500; font-size: 24px; margin-bottom: 8px;">Drums of War</h1>
          <p style="color: #9a9a9a; margin-bottom: 24px;">Welcome, <strong style="color: #e8e6e3;">${username}</strong>!</p>
          <p style="margin-bottom: 24px;">Click the button below to verify your email and activate your account on all three servers (Classic, TBC, WotLK).</p>
          <a href="${verifyUrl}" style="display: inline-block; padding: 12px 32px; background: linear-gradient(to right, #ff6b00, #ffa500); color: #0a0a0c; font-weight: 700; text-decoration: none; border-radius: 8px;">Verify Email</a>
          <p style="color: #666; font-size: 12px; margin-top: 32px;">If you didn't create this account, ignore this email. The link expires in 24 hours.</p>
        </div>
      `,
    });

    if (error) {
      console.error("[email] Resend error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] Send failed:", err);
    return false;
  }
}
