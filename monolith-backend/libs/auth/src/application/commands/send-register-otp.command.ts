import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConflictException } from '@nestjs/common';
import { UserRepository } from '../../domain/repositories/user.repository';
import { OtpRepository } from '../../domain/repositories/otp.repository';
import { OtpType } from '../../domain/enums/otp-type.enum';
import { EmailService } from '../../domain/services/email.service';

export class SendRegisterOtpCommand {
  constructor(public readonly email: string) {}
}

export interface SendRegisterOtpResult {
  success: boolean;
  message: string;
}

@CommandHandler(SendRegisterOtpCommand)
export class SendRegisterOtpHandler implements ICommandHandler<
  SendRegisterOtpCommand,
  SendRegisterOtpResult
> {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly otpRepository: OtpRepository,
    private readonly emailService: EmailService,
  ) {}

  async execute(
    command: SendRegisterOtpCommand,
  ): Promise<SendRegisterOtpResult> {
    const email = command.email.toLowerCase().trim();

    const existing = await this.userRepository.findByEmail(email);
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.otpRepository.create(email, code, OtpType.REGISTER, expiresAt);
    await this.emailService.sendOtpEmail(email, code, 'REGISTER');

    return {
      success: true,
      message: 'A 6-digit verification code has been sent to your email',
    };
  }
}
