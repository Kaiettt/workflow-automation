import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { oauth2RedirectUrl } from '@app/shared/utils/public-base-url';
import { ConnectorAuthType } from '../../../domain/enums/connector-auth-type.enum';
import { Connector } from '../../../domain/entities/connector.entity';

export class ConnectorResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  key: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: ConnectorAuthType })
  authType: ConnectorAuthType;

  @ApiProperty()
  configSchema: unknown;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional({
    description:
      'OAuth2 credential types: the redirect URL to register in the provider app',
  })
  oauth2?: { redirectUrl: string } | null;

  static fromDomain(entity: Connector): ConnectorResponseDto {
    const dto = new ConnectorResponseDto();
    dto.id = entity.id;
    dto.key = entity.key;
    dto.name = entity.name;
    dto.authType = entity.authType;
    dto.configSchema = entity.configSchema;
    dto.isActive = entity.isActive;
    dto.createdAt = entity.createdAt as Date;
    const isOAuth2Form =
      (entity.configSchema as { 'x-oauth2'?: unknown } | null)?.['x-oauth2'] ===
      true;
    dto.oauth2 = isOAuth2Form ? { redirectUrl: oauth2RedirectUrl() } : null;
    return dto;
  }
}
