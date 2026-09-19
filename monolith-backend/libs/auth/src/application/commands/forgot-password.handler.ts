import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { UserRepository } from '../../domain/repositories/user.repository';
import { OtpRepository } from '../../domain/repositories/otp.repository';
import { OtpType } from '../../domain/enums/otp-type.enum';
import { EmailService } from '../../infrastructure/services/email.service';

export class ForgotPasswordCommand {
  constructor(public readonly email: string) {}
}

export interface ForgotPasswordResult {
  success: boolean;
  message: string;
}

@CommandHandler(ForgotPasswordCommand)
export class ForgotPasswordHandler implements ICommandHandler<
  ForgotPasswordCommand,
  ForgotPasswordResult
> {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly otpRepository: OtpRepository,
    private readonly emailService: EmailService,
  ) {}

  async execute(command: ForgotPasswordCommand): Promise<ForgotPasswordResult> {
    const email = command.email.toLowerCase().trim();

    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new BadRequestException('No account found with this email address');
    }

    if (!user.isActive) {
      throw new BadRequestException(
        'Account is inactive. Please contact support.',
      );
    }

    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await this.otpRepository.create(
      email,
      code,
      OtpType.FORGOT_PASSWORD,
      expiresAt,
    );
    await this.emailService.sendOtpEmail(email, code, 'FORGOT_PASSWORD');

    return {
      success: true,
      message: 'A 6-digit verification code has been sent to your email',
    };
  }
}
