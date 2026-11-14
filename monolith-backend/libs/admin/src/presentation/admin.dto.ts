import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
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
} from 'class-validator';

export class PageDto {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
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
