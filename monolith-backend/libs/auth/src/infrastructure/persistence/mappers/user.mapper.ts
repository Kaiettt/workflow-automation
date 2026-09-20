import { User as PrismaUser, UserRole as PrismaUserRole } from '@prisma/client';
import { User } from '../../../domain/entities/user.entity';
import { UserRole } from '../../../domain/enums/user-role.enum';

export class UserMapper {
  public static toDomain(raw: PrismaUser): User {
    return User.create({
      id: raw.id,
      email: raw.email,
      passwordHash: raw.passwordHash,
      name: raw.name,
      role: raw.role as unknown as UserRole,
      isActive: raw.isActive,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }

  public static toPersistence(user: User): {
    id?: string;
    email: string;
    passwordHash: string;
    name: string;
    role: PrismaUserRole;
    isActive: boolean;
  } {
    return {
      ...(user.id ? { id: user.id } : {}),
      email: user.email,
      passwordHash: user.passwordHash,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
    };
  }
}
