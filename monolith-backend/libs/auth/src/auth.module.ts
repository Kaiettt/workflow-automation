import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '@app/database';

import { UserRepository } from './domain/repositories/user.repository';
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository';
import { OtpRepository } from './domain/repositories/otp.repository';
import { RedisOtpRepository } from './infrastructure/persistence/redis-otp.repository';
import { EmailService } from './infrastructure/services/email.service';

import { JwtStrategy } from './infrastructure/strategies/jwt.strategy';
import { JwtAuthGuard } from './infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from './infrastructure/guards/roles.guard';

import { RegisterHandler } from './application/commands/register.handler';
import { LoginHandler } from './application/commands/login.handler';
import { ForgotPasswordHandler } from './application/commands/forgot-password.handler';
import { ResetPasswordHandler } from './application/commands/reset-password.handler';
import { SendRegisterOtpHandler } from './application/commands/send-register-otp.handler';
import { GetCurrentUserHandler } from './application/queries/get-current-user.handler';

import { AuthController } from './presentation/http/auth.controller';

const CommandHandlers = [
  RegisterHandler,
  LoginHandler,
  ForgotPasswordHandler,
  ResetPasswordHandler,
  SendRegisterOtpHandler,
];
const QueryHandlers = [GetCurrentUserHandler];

@Module({
  imports: [
    CqrsModule,
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret:
        process.env.JWT_SECRET ||
        'flowpilot-secret-key-for-jwt-signing-minimum-32-chars',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: UserRepository,
      useClass: PrismaUserRepository,
    },
    {
      provide: OtpRepository,
      useClass: RedisOtpRepository,
    },
    EmailService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [
    UserRepository,
    OtpRepository,
    EmailService,
    JwtAuthGuard,
    RolesGuard,
    JwtModule,
  ],
})
export class AuthModule {}
