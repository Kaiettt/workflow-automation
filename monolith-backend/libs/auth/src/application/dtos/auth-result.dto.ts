import { UserRole } from '../../domain/enums/user-role.enum';

export interface UserResponseDto {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt?: Date;
}

export interface AuthResultDto {
  accessToken: string;
  user: UserResponseDto;
}
