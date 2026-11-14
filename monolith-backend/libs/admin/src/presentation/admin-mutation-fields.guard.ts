import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

const BODY_FIELDS = 'admin:body-fields';
export const AdminBodyFields = (field: 'role' | 'isActive') =>
  SetMetadata(BODY_FIELDS, ['expectedRevision', 'reason', field]);

// Validate raw field names before the global whitelist pipe strips unknown fields.
@Injectable()
export class AdminMutationFieldsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const allowed = this.reflector.get<string[] | undefined>(
      BODY_FIELDS,
      context.getHandler(),
    );
    if (!allowed) return true;
    const { body } = context.switchToHttp().getRequest<{ body: unknown }>();
    if (
      body &&
      typeof body === 'object' &&
      Object.keys(body).some((field) => !allowed.includes(field))
    ) {
      throw new BadRequestException(
        'Account mutation contains unsupported fields',
      );
    }
    return true;
  }
}
