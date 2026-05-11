import * as bcrypt from 'bcrypt';
import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.repo.findOneBy({ email });
  }

  findById(id: string): Promise<User | null> {
    return this.repo.findOneBy({ id });
  }

  async validatePassword(user: User, plain: string): Promise<boolean> {
    return bcrypt.compare(plain, user.hashedPassword);
  }

  async updateProfile(
    userId: string,
    dto: { name?: string; birthdate?: string | null; avatarUrl?: string | null },
  ): Promise<User> {
    const user = await this.repo.findOneByOrFail({ id: userId });
    if (dto.name !== undefined) user.name = dto.name;
    if (dto.birthdate !== undefined) {
      user.birthdate = dto.birthdate ? dto.birthdate.slice(0, 10) : null;
    }
    if (dto.avatarUrl !== undefined) user.avatarUrl = dto.avatarUrl;
    return this.repo.save(user);
  }

  async updatePassword(userId: string, newPlain: string): Promise<void> {
    const hashed = await bcrypt.hash(newPlain, 10);
    await this.repo.update({ id: userId }, { hashedPassword: hashed });
  }

  async createForRegister(dto: {
    email: string;
    password: string;
    name: string;
    gender: 'male' | 'female';
    birthdate?: string;
  }): Promise<User> {
    const existing = await this.repo.findOneBy({ email: dto.email });
    if (existing) throw new ConflictException('Email đã được đăng ký.');
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = this.repo.create({
      email: dto.email,
      name: dto.name,
      gender: dto.gender,
      birthdate: dto.birthdate ?? null,
      hashedPassword,
      familyId: null,
      role: null,
    });
    return this.repo.save(user);
  }
}
