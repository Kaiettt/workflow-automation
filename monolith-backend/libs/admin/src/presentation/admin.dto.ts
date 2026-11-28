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
import {
  ADMIN_AUDIT_ACTIONS,
  ADMIN_AUDIT_ACTOR_TYPES,
  ADMIN_AUDIT_TARGET_TYPES,
} from '../application/admin-audit.types';
import type {
  AdminAuditAction,
  AdminAuditActorType,
  AdminAuditTargetType,
} from '../application/admin-audit.types';
import type {
  AdminExecutionStatus,
  AdminTriggerType,
} from '../application/admin-execution.types';

export class PageDto {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}
export class AdminTimeRangeDto extends PageDto {
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/i)
  from?: string;
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/i)
  to?: string;
}
export class AdminExecutionFilterDto extends AdminTimeRangeDto {
  @IsOptional() @IsUUID() ownerId?: string;
  @IsOptional() @IsUUID() workflowId?: string;
  @IsOptional() @IsUUID() executionId?: string;
  @IsOptional() @IsIn(ADMIN_EXECUTION_STATUSES) status?: AdminExecutionStatus;
  @IsOptional() @IsIn(ADMIN_TRIGGER_TYPES) triggerType?: AdminTriggerType;
}
export class AdminAuditFilterDto extends AdminTimeRangeDto {
  @IsOptional() @IsUUID() actorId?: string;
  @IsOptional() @IsUUID() targetId?: string;
  @IsOptional() @IsIn(ADMIN_AUDIT_ACTOR_TYPES) actorType?: AdminAuditActorType;
  @IsOptional()
  @IsIn(ADMIN_AUDIT_TARGET_TYPES)
  targetType?: AdminAuditTargetType;
  @IsOptional() @IsIn(ADMIN_AUDIT_ACTIONS) action?: AdminAuditAction;
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

export class AdminBillingSubscriptionsDto extends PageDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  q?: string;
  @IsOptional() @IsIn(['ACTIVE', 'EXPIRED', 'CANCELLED']) status?:
    'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  @IsOptional() @IsUUID() planId?: string;
}
export class AdminBillingPaymentsDto extends PageDto {
  @IsOptional() @IsIn(['PENDING', 'COMPLETED', 'FAILED']) status?:
    'PENDING' | 'COMPLETED' | 'FAILED';
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/i)
  from?: string;
  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/i)
  to?: string;
}
export class AdminBillingRevenueDto {
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/i)
  from!: string;
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/i)
  to!: string;
}
export class UpdateBillingPlanDto {
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(1000000000)
  priceVnd?: number;
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(1000000000)
  monthlyQuota?: number;
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
  @IsInt() @Min(0) expectedRevision!: number;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(5, 500)
  reason!: string;
}
