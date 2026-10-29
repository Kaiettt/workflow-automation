import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

// Either `api_key` (single-key connectors such as LLM vendors) or `secret`
// with the fields of the connector's config_schema (e.g. Messenger Page).
export class CreateApiKeyCredentialDto {
  @ApiProperty({ example: 'OpenAI personal' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    description: 'Stored encrypted; never returned by the API',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  api_key?: string;

  @ApiPropertyOptional({
    description:
      'Fields of the connector config_schema, e.g. { page_id, page_access_token }. Stored encrypted.',
    example: { page_id: '112233445566', page_access_token: 'EAA...' },
  })
  @IsOptional()
  @IsObject()
  secret?: Record<string, unknown>;
}
