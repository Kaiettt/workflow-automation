import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { EmailService } from '../../domain/services/email.service';
import { EmailTemplateBuilder } from './templates/email-template.builder';

@Injectable()
export class NodemailerEmailService implements EmailService {
  private readonly logger = new Logger(NodemailerEmailService.name);
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

    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        ...(user && pass
          ? {
              auth: {
                user,
                pass,
              },
            }
          : {}),
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

    const rendered = EmailTemplateBuilder.buildOtpEmail({
      title,
      description,
      otp,
      subject,
      expiryMinutes: 5,
    });

    try {
      await this.transporter.sendMail({
        from: fromAddress,
        to: email,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
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
