import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRepository } from '../../domain/repositories/user.repository';
import { RefreshTokenRepository } from '../../domain/repositories/refresh-token.repository';
import { TokenResponseDto } from '../dtos/auth-result.dto';

export class RefreshTokenCommand {
  constructor(public readonly refreshToken: string) {}
}

interface JwtRefreshPayload {
  sub: string;
  type?: string;
}

@CommandHandler(RefreshTokenCommand)
export class RefreshTokenHandler implements ICommandHandler<
  RefreshTokenCommand,
  TokenResponseDto
> {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly jwtService: JwtService,
  ) {}

  async execute(command: RefreshTokenCommand): Promise<TokenResponseDto> {
    if (!command.refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    let payload: JwtRefreshPayload;
    try {
      payload = this.jwtService.verify<JwtRefreshPayload>(command.refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh' || !payload.sub) {
      throw new UnauthorizedException('Invalid refresh token type');
    }

    const userId = payload.sub;
    const isValid = await this.refreshTokenRepository.validate(
      userId,
      command.refreshToken,
    );
    if (!isValid) {
      throw new UnauthorizedException(
        'Refresh token has been revoked or expired',
      );
    }

    const user = await this.userRepository.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account is invalid or deactivated');
    }

    // Generate new token pair (rotation)
    const newAccessToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
      },
      { expiresIn: '15m' },
    );

    const newRefreshToken = this.jwtService.sign(
      { sub: user.id, type: 'refresh' },
      { expiresIn: '7d' },
    );

    const sevenDaysInSeconds = 7 * 24 * 60 * 60;
    await this.refreshTokenRepository.save(
      user.id!,
      newRefreshToken,
      sevenDaysInSeconds,
    );

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }
}
