import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  ValidateIf,
  IsUUID,
  IsBooleanString,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  Matches,
} from 'class-validator';
import {
  ADMIN_EXECUTION_STATUSES,
  ADMIN_TRIGGER_TYPES,
} from '../application/admin-execution.types';
import type {
  AdminExecutionStatus,
  AdminTriggerType,
} from '../application/admin-execution.types';

export class PageDto {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}
export class AdminExecutionFilterDto extends PageDto {
  @IsOptional() @IsUUID() ownerId?: string;
  @IsOptional() @IsUUID() workflowId?: string;
  @IsOptional() @IsUUID() executionId?: string;
  @IsOptional() @IsIn(ADMIN_EXECUTION_STATUSES) status?: AdminExecutionStatus;
  @IsOptional() @IsIn(ADMIN_TRIGGER_TYPES) triggerType?: AdminTriggerType;
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/i)
  from?: string;
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/i)
  to?: string;
}
export class UsersDto extends PageDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  q?: string;
  @IsOptional() @IsIn(['ADMIN', 'CLIENT']) role?: 'ADMIN' | 'CLIENT';
  @IsOptional() @IsBooleanString() isActive?: string;
}
export class ConnectorsDto extends PageDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  q?: string;
  @IsOptional()
  @IsIn(['NONE', 'API_KEY', 'OAUTH2', 'BASIC'])
  authType?: 'NONE' | 'API_KEY' | 'OAUTH2' | 'BASIC';
  @IsOptional() @IsBooleanString() isActive?: string;
  @IsOptional() @IsBooleanString() allowNewCredentials?: string;
}
export class NodeTypesDto extends PageDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  q?: string;
  @IsOptional()
  @IsIn(['TRIGGER', 'LOGIC', 'DATA_PROCESSING', 'INTEGRATION', 'AI'])
  category?: 'TRIGGER' | 'LOGIC' | 'DATA_PROCESSING' | 'INTEGRATION' | 'AI';
  @IsOptional() @IsUUID() connectorId?: string;
  @IsOptional() @IsBooleanString() isCatalogVisible?: string;
  @IsOptional() @IsBooleanString() isExecutionAllowed?: string;
  @IsOptional() @IsIn(['displayName', 'updatedAt']) sortBy:
    'displayName' | 'updatedAt' = 'displayName';
  @IsOptional() @IsIn(['asc', 'desc']) sortOrder: 'asc' | 'desc' = 'asc';
}
export class NodeTypeKeyDto {
  @IsString() @Length(1, 150) key!: string;
}
export class ChangeNodeTypeStatusDto {
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsBoolean()
  isCatalogVisible?: boolean;
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsBoolean()
  isExecutionAllowed?: boolean;
  @IsInt() @Min(0) expectedRevision!: number;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(5, 500)
  reason!: string;
}
export class ChangeConnectorPolicyDto {
  @IsBoolean() allowNewCredentials!: boolean;
  @IsInt() @Min(0) expectedRevision!: number;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(5, 500)
  reason!: string;
}
export class ChangeAccountDto {
  @IsInt() @Min(0) expectedRevision: number;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(5, 500)
  reason: string;
}
export class ActiveDto extends ChangeAccountDto {
  @IsBoolean() isActive: boolean;
}
export class RoleDto extends ChangeAccountDto {
  @IsIn(['ADMIN', 'CLIENT']) role: 'ADMIN' | 'CLIENT';
}
export class DashboardDto {
  @IsOptional() @IsISO8601() from?: string;
  @IsOptional() @IsISO8601() to?: string;
  @IsOptional() @IsString() @MaxLength(100) timezone = 'UTC';
}
