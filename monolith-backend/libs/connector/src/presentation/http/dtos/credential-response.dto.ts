import { ApiProperty } from '@nestjs/swagger';
import { CredentialSummary } from '../../../application/dtos/credential-summary.dto';

export class CredentialResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  connectorKey: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  createdAt: Date;

  static fromSummary(summary: CredentialSummary): CredentialResponseDto {
    const dto = new CredentialResponseDto();
    dto.id = summary.id;
    dto.connectorKey = summary.connectorKey;
    dto.name = summary.name;
    dto.createdAt = summary.createdAt;
    return dto;
  }
}
