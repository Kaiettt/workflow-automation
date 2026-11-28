import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import {
  RegisterCommand,
  RegisterHandler,
} from '@app/auth/application/commands/register.command';
import { UserRepository } from '@app/auth/domain/repositories/user.repository';
import { OtpRepository } from '@app/auth/domain/repositories/otp.repository';
import { RefreshTokenRepository } from '@app/auth/domain/repositories/refresh-token.repository';
import { UserRole } from '@app/auth/domain/enums/user-role.enum';
import {
  SUBSCRIPTION_PROVISIONING_PORT,
  SubscriptionProvisioningPort,
} from '@app/subscription';

describe('RegisterHandler [SCENARIO-SUB-01]', () => {
  let handler: RegisterHandler;
  let userRepo: jest.Mocked<UserRepository>;
  let otpRepo: jest.Mocked<OtpRepository>;
  let refreshTokenRepo: jest.Mocked<RefreshTokenRepository>;
  let jwtService: jest.Mocked<JwtService>;
  let subscriptionProvisioning: jest.Mocked<SubscriptionProvisioningPort>;

  beforeEach(async () => {
    userRepo = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    otpRepo = {
      isVerified: jest.fn(),
      consumeVerified: jest.fn(),
      findLatestValid: jest.fn(),
      markAsUsed: jest.fn(),
      save: jest.fn(),
    } as any;

    refreshTokenRepo = {
      save: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
    } as any;

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    } as any;

    subscriptionProvisioning = {
      allocateDefaultFreeSubscription: jest.fn().mockResolvedValue({} as any),
      getActiveSubscription: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegisterHandler,
        { provide: UserRepository, useValue: userRepo },
        { provide: OtpRepository, useValue: otpRepo },
        { provide: RefreshTokenRepository, useValue: refreshTokenRepo },
        { provide: JwtService, useValue: jwtService },
        {
          provide: SUBSCRIPTION_PROVISIONING_PORT,
          useValue: subscriptionProvisioning,
        },
      ],
    }).compile();

    handler = module.get<RegisterHandler>(RegisterHandler);
  });

  it('should auto-allocate FREE subscription tier when a CLIENT user registers [SCENARIO-SUB-01]', async () => {
    otpRepo.isVerified.mockResolvedValue(true);
    userRepo.findByEmail.mockResolvedValue(null);
    userRepo.create.mockResolvedValue('new-client-user-id');

    const command = new RegisterCommand(
      'newclient@example.com',
      'SecurePass123!',
      'New Client',
    );

    const result = await handler.execute(command);

    expect(userRepo.create).toHaveBeenCalled();
    expect(
      subscriptionProvisioning.allocateDefaultFreeSubscription,
    ).toHaveBeenCalledWith('new-client-user-id');
    expect(result.user.id).toBe('new-client-user-id');
    expect(result.user.role).toBe(UserRole.CLIENT);
  });
});
