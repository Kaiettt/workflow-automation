import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length, IsEnum } from 'class-validator';
import { OtpType } from '../../../domain/enums/otp-type.enum';

export class VerifyOtpDto {
  @ApiProperty({ example: 'developer@flowpilot.io' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  @IsNotEmpty()
  otp: string;

  @ApiProperty({ enum: OtpType, example: OtpType.REGISTER })
  @IsEnum(OtpType, { message: 'Type must be REGISTER or FORGOT_PASSWORD' })
  @IsNotEmpty()
  type: OtpType;
}
