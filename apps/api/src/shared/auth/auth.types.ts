import type { UserRole } from '../../modules/users/entities/user.entity';

/** Encoded inside the JWT — keep small. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole | null;
  familyId: string | null;
}

/** Returned to the client on login + me. */
export interface AuthUserDto {
  id: string;
  name: string;
  email: string;
  role: UserRole | null;
  gender: 'male' | 'female';
  familyId: string | null;
  birthdate: string | null;
}

export interface LoginResponseDto {
  accessToken: string;
  user: AuthUserDto;
}
