import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUser } from '../../shared/auth/decorators/current-user.decorator';
import { FamilyRequiredGuard } from '../../shared/auth/guards/family-required.guard';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { User } from '../users/entities/user.entity';
import { Category } from './entities/category.entity';

export interface CategoryView {
  id: string;
  name: string;
  parentId: string | null;
  parentName: string | null;
  icon: string | null;
  isEssential: boolean;
}

@UseGuards(JwtAuthGuard, FamilyRequiredGuard)
@Controller('api/categories')
export class CategoriesController {
  constructor(
    @InjectRepository(Category)
    private readonly repo: Repository<Category>,
  ) {}

  /** GET /api/categories — flat list with parent reference for grouping. */
  @Get()
  async list(@CurrentUser() user: User): Promise<CategoryView[]> {
    const rows = await this.repo.find({
      where: { familyId: user.familyId! },
      relations: { parent: true },
      order: { name: 'ASC' },
    });
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      parentId: c.parentId,
      parentName: c.parent?.name ?? null,
      icon: c.icon,
      isEssential: c.isEssential,
    }));
  }
}
