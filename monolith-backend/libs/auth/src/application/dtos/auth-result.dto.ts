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
  refreshToken: string;
  user: UserResponseDto;
}

export interface TokenResponseDto {
  accessToken: string;
  refreshToken: string;
}
