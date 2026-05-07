import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Category } from './entities/category.entity';

export interface CategoryView {
  id: string;
  name: string;
  parentId: string | null;
  parentName: string | null;
  icon: string | null;
  isEssential: boolean;
}

@UseGuards(JwtAuthGuard)
@Controller('api/categories')
export class CategoriesController {
  constructor(
    @InjectRepository(Category)
    private readonly repo: Repository<Category>,
  ) {}

  /** GET /api/categories — flat list with parent reference for grouping. */
  @Get()
  async list(): Promise<CategoryView[]> {
    const rows = await this.repo.find({
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
