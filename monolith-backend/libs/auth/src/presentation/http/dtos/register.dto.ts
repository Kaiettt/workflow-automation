import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  IsIn,
  ValidateIf,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'dev@flowpilot.local' })
  @IsEmail({}, { message: 'Must be a valid email address' })
  email: string;

  @ApiProperty({ example: 'FlowPilot123!', minLength: 8 })
  @IsString()
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/,
    {
      message:
        'Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character',
    },
  )
  password: string;

  @ApiProperty({ example: 'Alex Mercer' })
  @IsString()
  @IsNotEmpty({ message: 'Name cannot be empty' })
  name: string;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsIn([], { message: 'Role cannot be selected during registration' })
  role?: never;

  @ApiPropertyOptional({ example: '123456', minLength: 6, maxLength: 6 })
  @IsOptional()
  @IsString()
  @Length(6, 6, { message: 'Verification code must be exactly 6 digits' })
  otp?: string;
}
