import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateApiKeyCredentialDto {
  @ApiProperty({ example: 'OpenAI personal' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ description: 'Stored encrypted; never returned by the API' })
  @IsString()
  @IsNotEmpty()
  api_key: string;
}
