import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { LoginDto } from './dto/login.dto';
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
      // Same error msg whether email or password is wrong → don't leak which
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    const ok = await this.usersService.validatePassword(user, dto.password);
    if (!ok) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = await this.jwtService.signAsync(payload);
    return { accessToken, user: this.toAuthUser(user) };
  }

  toAuthUser(user: User): AuthUserDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
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
