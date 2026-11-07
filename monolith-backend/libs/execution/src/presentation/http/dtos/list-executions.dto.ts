import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ListExecutionsDto {
  @IsUUID()
  workflow_id: string;

  @IsOptional()
  @IsUUID()
  workflow_version_id?: string;

  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
