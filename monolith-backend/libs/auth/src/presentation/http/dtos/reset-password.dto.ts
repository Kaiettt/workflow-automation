import { IsEmail, IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ example: 'dev@flowpilot.local' })
  @IsEmail({}, { message: 'Must be a valid email address' })
  email: string;

  @ApiProperty({ example: '123456', minLength: 6, maxLength: 6 })
  @IsString()
  @Length(6, 6, { message: 'Verification code must be exactly 6 digits' })
  otp: string;

  @ApiProperty({ example: 'NewSecretPass123!', minLength: 8 })
  @IsString()
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/,
    {
      message:
        'New password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character',
    },
  )
  newPassword: string;
}
