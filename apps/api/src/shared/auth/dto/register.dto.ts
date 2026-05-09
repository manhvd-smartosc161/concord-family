import {
  IsEmail,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @Length(1, 80)
  name!: string;

  @IsIn(['male', 'female'])
  gender!: 'male' | 'female';

  @IsOptional()
  @IsISO8601()
  birthdate?: string;
}
