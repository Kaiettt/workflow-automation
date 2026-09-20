import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UserRepository } from '../../domain/repositories/user.repository';
import { OtpRepository } from '../../domain/repositories/otp.repository';
import { OtpType } from '../../domain/enums/otp-type.enum';

export class ResetPasswordCommand {
  constructor(
    public readonly email: string,
    public readonly otp: string,
    public readonly newPassword: string,
  ) {}
}

export interface ResetPasswordResult {
  success: boolean;
  message: string;
}

@CommandHandler(ResetPasswordCommand)
export class ResetPasswordHandler implements ICommandHandler<
  ResetPasswordCommand,
  ResetPasswordResult
> {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly otpRepository: OtpRepository,
  ) {}

  async execute(command: ResetPasswordCommand): Promise<ResetPasswordResult> {
    const email = command.email.toLowerCase().trim();

    // 1. Verify OTP
    const validOtp = await this.otpRepository.findLatestValid(
      email,
      command.otp.trim(),
      OtpType.FORGOT_PASSWORD,
    );
    if (!validOtp) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    // 2. Find user
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // 3. Hash new password
    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(command.newPassword, salt);

    // 4. Update user password
    user.changePassword(newPasswordHash);
    await this.userRepository.update(user);

    // 5. Mark OTP as used
    await this.otpRepository.markAsUsed(validOtp.id);

    return {
      success: true,
      message:
        'Your password has been successfully reset. You can now sign in with your new password.',
    };
  }
}
