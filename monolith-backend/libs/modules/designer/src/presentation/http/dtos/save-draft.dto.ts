import { IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SaveDraftDto {
  @ApiProperty({ description: 'The React Flow graph definition' })
  @IsObject()
  definition!: Record<string, any>;
}
