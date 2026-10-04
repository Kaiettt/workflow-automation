import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum RestoreStrategy {
  PUBLISH_THEN_RESTORE = 'PUBLISH_THEN_RESTORE',
  BACKUP_THEN_RESTORE = 'BACKUP_THEN_RESTORE',
  OVERWRITE = 'OVERWRITE',
}

export class RestoreVersionDto {
  @ApiProperty({
    enum: RestoreStrategy,
    description: 'Chiến lược giải quyết khi khôi phục phiên bản',
    example: RestoreStrategy.PUBLISH_THEN_RESTORE,
  })
  @IsEnum(RestoreStrategy)
  strategy: RestoreStrategy;

  @ApiPropertyOptional({
    description: 'Tên workflow backup mới nếu chọn BACKUP_THEN_RESTORE',
    example: '[Backup] Workflow Test - 2026-10-04',
  })
  @IsOptional()
  @IsString()
  backupWorkflowName?: string;

  @ApiPropertyOptional({
    description: 'Ghi chú khi xuất bản bản nháp hiện tại',
  })
  @IsOptional()
  @IsString()
  publishComment?: string;
}
