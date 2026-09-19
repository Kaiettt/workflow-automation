import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass,
        },
      });
      this.logger.log(
        `SMTP transport initialized (${host}:${port}, secure=${secure})`,
      );
    } else {
      this.logger.warn(
        'SMTP configuration is not set in .env. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS to send OTP emails.',
      );
    }
  }

  async sendOtpEmail(
    email: string,
    otp: string,
    purpose: 'REGISTER' | 'FORGOT_PASSWORD',
  ): Promise<void> {
    // Re-check transporter if env variables were loaded dynamically
    if (!this.transporter) {
      this.initTransporter();
    }

    if (!this.transporter) {
      throw new InternalServerErrorException(
        'SMTP email service is not configured. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS in .env to send OTP emails.',
      );
    }

    const isRegister = purpose === 'REGISTER';
    const subject = isRegister
      ? 'FlowPilot - Your Registration Verification Code'
      : 'FlowPilot - Your Password Reset Code';

    const title = isRegister
      ? 'Verify Your Email Address'
      : 'Reset Your Password';
    const description = isRegister
      ? 'Thank you for creating an account with FlowPilot. Please enter the following 6-digit verification code to complete your registration:'
      : 'We received a request to reset your FlowPilot account password. Enter the following 6-digit code to proceed:';

    const fromAddress =
      process.env.SMTP_FROM || 'FlowPilot <no-reply@flowpilot.io>';

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f4f4f5;
      margin: 0;
      padding: 24px;
      color: #18181b;
    }
    .container {
      max-width: 520px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e4e4e7;
      border-radius: 12px;
      padding: 32px 28px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }
    .brand {
      display: flex;
      align-items: center;
      margin-bottom: 24px;
    }
    .brand-logo {
      display: inline-block;
      width: 28px;
      height: 28px;
      background-color: #18181b;
      color: #ffffff;
      border-radius: 6px;
      text-align: center;
      line-height: 28px;
      font-weight: bold;
      font-size: 16px;
      margin-right: 10px;
    }
    .brand-name {
      font-size: 18px;
      font-weight: 700;
      color: #18181b;
      letter-spacing: -0.5px;
    }
    h1 {
      font-size: 20px;
      font-weight: 600;
      margin-top: 0;
      margin-bottom: 12px;
      color: #09090b;
    }
    p {
      font-size: 14px;
      line-height: 1.6;
      color: #52525b;
      margin-bottom: 20px;
    }
    .otp-box {
      background: #f4f4f5;
      border: 1px dashed #d4d4d8;
      border-radius: 8px;
      padding: 16px 24px;
      text-align: center;
      margin: 24px 0;
    }
    .otp-code {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
      font-size: 32px;
      font-weight: 700;
      letter-spacing: 6px;
      color: #18181b;
    }
    .expiry {
      font-size: 12px;
      color: #71717a;
      margin-top: 8px;
    }
    .footer {
      border-top: 1px solid #f4f4f5;
      padding-top: 16px;
      margin-top: 24px;
      font-size: 12px;
      color: #a1a1aa;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="brand">
      <span class="brand-logo">⚡</span>
      <span class="brand-name">FlowPilot</span>
    </div>

    <h1>${title}</h1>
    <p>${description}</p>

    <div class="otp-box">
      <div class="otp-code">${otp}</div>
      <div class="expiry">Expires in 5 minutes. Do not share this code with anyone.</div>
    </div>

    <p>If you did not make this request, please safely ignore this email or contact support.</p>

    <div class="footer">
      This is an automated notification from FlowPilot Workflow Orchestration Engine.<br />
      Please do not reply directly to this email.
    </div>
  </div>
</body>
</html>
    `.trim();

    const textContent = `
FlowPilot - ${title}

${description}

Verification Code: ${otp}
(Expires in 5 minutes)

If you did not make this request, please ignore this email.
    `.trim();

    try {
      await this.transporter.sendMail({
        from: fromAddress,
        to: email,
        subject,
        text: textContent,
        html: htmlContent,
      });
      this.logger.log(`OTP email sent successfully to ${email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${email}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new InternalServerErrorException(
        `Failed to send verification email: ${(error as Error).message}`,
      );
    }
  }
}
