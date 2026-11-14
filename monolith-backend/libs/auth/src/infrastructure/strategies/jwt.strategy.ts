import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserRepository } from '../../domain/repositories/user.repository';
import { UserRole } from '../../domain/enums/user-role.enum';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
  sessionVersion?: number;
  type?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly userRepository: UserRepository) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        process.env.JWT_SECRET ||
        'flowpilot-secret-key-for-jwt-signing-minimum-32-chars',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.userRepository.findById(payload.sub);
    if (
      payload.type === 'refresh' ||
      !user ||
      !user.isActive ||
      payload.sessionVersion !== user.sessionVersion
    ) {
      throw new UnauthorizedException('User no longer active or valid');
    }
    return {
      id: user.id!,
      email: user.email,
      name: user.name,
      role: user.role,
      sessionVersion: user.sessionVersion,
    };
  }
}
