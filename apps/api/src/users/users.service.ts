import * as bcrypt from 'bcrypt';
import { Injectable } from '@nestjs/common';
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

  async updatePassword(userId: string, newPlain: string): Promise<void> {
    const hashed = await bcrypt.hash(newPlain, 10);
    await this.repo.update({ id: userId }, { hashedPassword: hashed });
  }
}
