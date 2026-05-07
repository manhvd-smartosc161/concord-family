import type { UserRole } from '../../modules/users/entities/user.entity';

/** Encoded inside the JWT — keep small. */
export interface JwtPayload {
  sub: string; // user id
  email: string;
  role: UserRole;
}

/** Returned to the client on login + me. */
export interface AuthUserDto {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface LoginResponseDto {
  accessToken: string;
  user: AuthUserDto;
}
