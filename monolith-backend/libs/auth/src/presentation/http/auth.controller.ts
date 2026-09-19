import { Controller, Post, Get, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RegisterDto } from './dtos/register.dto';
import { LoginDto } from './dtos/login.dto';
import { ForgotPasswordDto } from './dtos/forgot-password.dto';
import { ResetPasswordDto } from './dtos/reset-password.dto';
import { SendRegisterOtpDto } from './dtos/send-register-otp.dto';
import { RegisterCommand } from '../../application/commands/register.handler';
import { LoginCommand } from '../../application/commands/login.handler';
import { ForgotPasswordCommand } from '../../application/commands/forgot-password.handler';
import { ResetPasswordCommand } from '../../application/commands/reset-password.handler';
import { SendRegisterOtpCommand } from '../../application/commands/send-register-otp.handler';
import { GetCurrentUserQuery } from '../../application/queries/get-current-user.handler';
import { JwtAuthGuard } from '../../infrastructure/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../../infrastructure/decorators/current-user.decorator';
import { Public } from '../../infrastructure/decorators/public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Public()
  @Post('send-register-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send 6-digit OTP code for registration verification' })
  @ApiResponse({ status: 200, description: 'OTP sent to email if email not taken' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async sendRegisterOtp(@Body() dto: SendRegisterOtpDto) {
    const command = new SendRegisterOtpCommand(dto.email);
    const result = await this.commandBus.execute(command);
    return {
      success: true,
      data: result,
    };
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user with OTP verification' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async register(@Body() dto: RegisterDto) {
    const command = new RegisterCommand(dto.email, dto.password, dto.name, dto.otp, dto.role);
    const result = await this.commandBus.execute(command);
    return {
      success: true,
      data: result,
    };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful, returns JWT accessToken' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto) {
    const command = new LoginCommand(dto.email, dto.password);
    const result = await this.commandBus.execute(command);
    return {
      success: true,
      data: result,
    };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset OTP code via email' })
  @ApiResponse({ status: 200, description: 'OTP sent to email if account exists' })
  @ApiResponse({ status: 400, description: 'User not found or inactive' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    const command = new ForgotPasswordCommand(dto.email);
    const result = await this.commandBus.execute(command);
    return {
      success: true,
      data: result,
    };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with OTP verification code' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    const command = new ResetPasswordCommand(dto.email, dto.otp, dto.newPassword);
    const result = await this.commandBus.execute(command);
    return {
      success: true,
      data: result,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get profile of current logged-in user' })
  @ApiResponse({ status: 200, description: 'Profile returned successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    const query = new GetCurrentUserQuery(user.id);
    const result = await this.queryBus.execute(query);
    return {
      success: true,
      data: result,
    };
  }
}
