import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { OtpRepository } from '../../domain/repositories/otp.repository';
import { OtpType } from '../../domain/enums/otp-type.enum';

export class VerifyOtpCommand {
  constructor(
    public readonly email: string,
    public readonly otp: string,
    public readonly type: OtpType,
  ) {}
}

export interface VerifyOtpResult {
  success: boolean;
  message: string;
}

@CommandHandler(VerifyOtpCommand)
export class VerifyOtpHandler implements ICommandHandler<
  VerifyOtpCommand,
  VerifyOtpResult
> {
  constructor(private readonly otpRepository: OtpRepository) {}

  async execute(command: VerifyOtpCommand): Promise<VerifyOtpResult> {
    const email = command.email.toLowerCase().trim();
    const otp = command.otp.trim();

    const validOtp = await this.otpRepository.findLatestValid(
      email,
      otp,
      command.type,
    );

    if (!validOtp) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    // Mark OTP code as used (deleted)
    await this.otpRepository.markAsUsed(validOtp.id);

    // Record verified status with a 15-minute TTL so registration/reset can complete
    await this.otpRepository.markAsVerified(email, command.type, 15 * 60);

    return {
      success: true,
      message: 'Verification code verified successfully',
    };
  }
}
