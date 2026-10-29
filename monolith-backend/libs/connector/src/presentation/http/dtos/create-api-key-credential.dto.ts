import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

// Either `api_key` (single-key connectors such as LLM vendors) or `secret`
// with the fields of the connector's config_schema (e.g. App ID / App Secret
// of an OAuth2 app, connected afterwards with /api/oauth2/auth).
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
      'Fields of the connector config_schema, e.g. { client_id, client_secret }. Stored encrypted.',
    example: { client_id: '112233445566', client_secret: '...' },
  })
  @IsOptional()
  @IsObject()
  secret?: Record<string, unknown>;
}
