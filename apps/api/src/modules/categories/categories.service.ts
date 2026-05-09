import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Category } from './entities/category.entity';

export interface CreateCategoryInput {
  name: string;
  icon?: string;
  isEssential: boolean;
  parentName?: string;
}

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
  ) {}

  async createCategory(input: CreateCategoryInput, user: User): Promise<Category> {
    const familyId = user.familyId!;
    const trimmedName = input.name.trim();

    const existing = await this.categoryRepo
      .createQueryBuilder('c')
      .where('c.family_id = :familyId', { familyId })
      .andWhere('LOWER(c.name) = LOWER(:name)', { name: trimmedName })
      .getOne();
    if (existing) return existing;

    let parentId: string | null = null;
    if (input.parentName) {
      const parent = await this.resolveByName(input.parentName, familyId);
      if (parent && parent.parentId === null) {
        parentId = parent.id;
      }
    }

    const created = this.categoryRepo.create({
      familyId,
      name: trimmedName,
      icon: input.icon?.trim() || null,
      isEssential: input.isEssential,
      parentId,
    });
    return this.categoryRepo.save(created);
  }

  private async resolveByName(name: string, familyId: string): Promise<Category | null> {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const exact = await this.categoryRepo
      .createQueryBuilder('c')
      .where('c.family_id = :familyId', { familyId })
      .andWhere('LOWER(c.name) = LOWER(:n)', { n: trimmed })
      .getOne();
    if (exact) return exact;
    return this.categoryRepo
      .createQueryBuilder('c')
      .where('c.family_id = :familyId', { familyId })
      .andWhere('c.name ILIKE :n', { n: `%${trimmed}%` })
      .orderBy('LENGTH(c.name)', 'ASC')
      .getOne();
  }
}
