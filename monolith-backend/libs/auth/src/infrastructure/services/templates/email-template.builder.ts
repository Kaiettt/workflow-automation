export interface EmailTemplateOptions {
  title: string;
  description: string;
  otp: string;
  subject: string;
  expiryMinutes?: number;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export class EmailTemplateBuilder {
  /**
   * Generates a branded, responsive HTML & plain-text email for OTP verification
   */
  static buildOtpEmail(options: EmailTemplateOptions): RenderedEmail {
    const { title, description, otp, subject, expiryMinutes = 5 } = options;

    const html = `
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
      <div class="expiry">Expires in ${expiryMinutes} minutes. Do not share this code with anyone.</div>
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

    const text = `
FlowPilot - ${title}

${description}

Verification Code: ${otp}
(Expires in ${expiryMinutes} minutes)

If you did not make this request, please ignore this email.
    `.trim();

    return { subject, html, text };
  }
}
