import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { UserRepository } from '../../domain/repositories/user.repository';
import { UserResponseDto } from '../dtos/auth-result.dto';

export class GetCurrentUserQuery {
  constructor(public readonly userId: string) {}
}

@QueryHandler(GetCurrentUserQuery)
export class GetCurrentUserHandler implements IQueryHandler<
  GetCurrentUserQuery,
  UserResponseDto
> {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(query: GetCurrentUserQuery): Promise<UserResponseDto> {
    const user = await this.userRepository.findById(query.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id!,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }
}
