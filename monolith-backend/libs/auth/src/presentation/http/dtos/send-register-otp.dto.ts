import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendRegisterOtpDto {
  @ApiProperty({ example: 'dev@flowpilot.local' })
  @IsEmail({}, { message: 'Must be a valid email address' })
  email: string;
}
