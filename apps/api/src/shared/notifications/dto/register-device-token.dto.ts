import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDeviceTokenDto {
  @IsString()
  @MinLength(20)
  @MaxLength(512)
  token!: string;

  @IsEnum(['ios_pwa', 'android', 'desktop'])
  platform!: 'ios_pwa' | 'android' | 'desktop';
}
