export type UserRole = 'husband' | 'wife';
export type UserGender = 'male' | 'female';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole | null;
  gender: UserGender;
  familyId: string | null;
  birthdate: string | null;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  gender: UserGender;
  birthdate?: string;
}
