import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { User } from '../../modules/users/entities/user.entity';
import { UsersService } from '../../modules/users/users.service';
import { EmailService } from '../notifications/email.service';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { ForgotPasswordDto } from './dto/forgot-password.dto';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { ResetPasswordDto } from './dto/reset-password.dto';
import type { AuthUserDto, JwtPayload, LoginResponseDto } from './auth.types';
import { PasswordResetToken } from './entities/password-reset-token.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @InjectRepository(PasswordResetToken)
    private readonly resetTokenRepo: Repository<PasswordResetToken>,
    private readonly emailService: EmailService,
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

  async requestPasswordReset(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) return;

    await this.resetTokenRepo
      .createQueryBuilder()
      .delete()
      .where('user_id = :userId AND used_at IS NULL', { userId: user.id })
      .execute();

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await this.resetTokenRepo.save(
      this.resetTokenRepo.create({
        token,
        userId: user.id,
        expiresAt,
        usedAt: null,
      }),
    );

    const baseUrl = process.env.WEB_BASE_URL ?? 'http://localhost:3000';
    const link = `${baseUrl}/reset-password?token=${token}`;

    await this.emailService.send(user.email, {
      subject: 'Đặt lại mật khẩu Concord',
      text: [
        `Chào ${user.name},`,
        ``,
        `Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.`,
        ``,
        `Nhấn vào link sau để tạo mật khẩu mới (hết hạn sau 1 giờ):`,
        `${link}`,
        ``,
        `Nếu bạn không yêu cầu điều này, hãy bỏ qua email này.`,
      ].join('\n'),
      html: `
        <p>Chào <strong>${user.name}</strong>,</p>
        <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản <strong>${user.email}</strong> trên Concord.</p>
        <p style="margin:24px 0">
          <a href="${link}" style="background:#047857;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
            Đặt lại mật khẩu
          </a>
        </p>
        <p style="color:#6b7280;font-size:13px">Link hết hạn sau <strong>1 giờ</strong>. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
        <p style="color:#6b7280;font-size:12px">Hoặc copy link: ${link}</p>
      `,
    });
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const record = await this.resetTokenRepo.findOne({
      where: { token: dto.token },
    });

    if (!record) {
      throw new BadRequestException('Link đặt lại mật khẩu không hợp lệ.');
    }
    if (record.usedAt !== null) {
      throw new BadRequestException('Link đặt lại mật khẩu đã được sử dụng.');
    }
    if (record.expiresAt < new Date()) {
      throw new BadRequestException('Link đặt lại mật khẩu đã hết hạn.');
    }

    await this.resetTokenRepo.update({ id: record.id }, { usedAt: new Date() });
    await this.usersService.updatePassword(record.userId, dto.newPassword);
  }
}
