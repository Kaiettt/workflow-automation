import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UserRole } from '../../domain/enums/user-role.enum';
import { User } from '../../domain/entities/user.entity';
import { UserRepository } from '../../domain/repositories/user.repository';
import { OtpRepository } from '../../domain/repositories/otp.repository';
import { OtpType } from '../../domain/enums/otp-type.enum';
import { AuthResultDto } from '../dtos/auth-result.dto';

export class RegisterCommand {
  constructor(
    public readonly email: string,
    public readonly password: string,
    public readonly name: string,
    public readonly otp: string,
    public readonly role?: UserRole,
  ) {}
}

@CommandHandler(RegisterCommand)
export class RegisterHandler implements ICommandHandler<
  RegisterCommand,
  AuthResultDto
> {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly otpRepository: OtpRepository,
    private readonly jwtService: JwtService,
  ) {}

  async execute(command: RegisterCommand): Promise<AuthResultDto> {
    const email = command.email.toLowerCase().trim();

    // 1. Verify OTP
    const validOtp = await this.otpRepository.findLatestValid(
      email,
      command.otp.trim(),
      OtpType.REGISTER,
    );
    if (!validOtp) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    // 2. Check if user already exists
    const existing = await this.userRepository.findByEmail(email);
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    // 3. Hash password and create user
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(command.password, salt);

    const user = User.create({
      email,
      passwordHash,
      name: command.name,
      role: command.role || UserRole.DEVELOPER,
      isActive: true,
    });

    const userId = await this.userRepository.create(user);

    // 4. Mark OTP as used
    await this.otpRepository.markAsUsed(validOtp.id);

    // 5. Generate JWT token
    const payload = {
      sub: userId,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: userId,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
      },
    };
  }
}
