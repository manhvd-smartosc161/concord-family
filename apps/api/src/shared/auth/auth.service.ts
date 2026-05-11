import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '../../modules/users/entities/user.entity';
import { UsersService } from '../../modules/users/users.service';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { AuthUserDto, JwtPayload, LoginResponseDto } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    const ok = await this.usersService.validatePassword(user, dto.password);
    if (!ok) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    return this.issueTokenForUser(user);
  }

  async register(dto: RegisterDto): Promise<LoginResponseDto> {
    const user = await this.usersService.createForRegister(dto);
    return this.issueTokenForUser(user);
  }

  issueTokenForUser(user: User): LoginResponseDto {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      familyId: user.familyId,
    };
    const accessToken = this.jwtService.sign(payload);
    return { accessToken, user: this.toAuthUser(user) };
  }

  toAuthUser(user: User): AuthUserDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      gender: user.gender,
      familyId: user.familyId,
      birthdate: user.birthdate,
      avatarUrl: user.avatarUrl,
    };
  }

  async changePassword(user: User, dto: ChangePasswordDto): Promise<void> {
    const ok = await this.usersService.validatePassword(
      user,
      dto.currentPassword,
    );
    if (!ok) {
      throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');
    }
    await this.usersService.updatePassword(user.id, dto.newPassword);
  }
}
