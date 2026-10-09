import { ApiProperty } from '@nestjs/swagger';
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

  static fromDomain(entity: Connector): ConnectorResponseDto {
    const dto = new ConnectorResponseDto();
    dto.id = entity.id;
    dto.key = entity.key;
    dto.name = entity.name;
    dto.authType = entity.authType;
    dto.configSchema = entity.configSchema;
    dto.isActive = entity.isActive;
    dto.createdAt = entity.createdAt as Date;
    return dto;
  }
}
