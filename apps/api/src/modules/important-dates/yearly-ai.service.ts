import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { buildYearlyAgenda } from './lib/lunar';
import { YearlyAiCache } from './entities/yearly-ai-cache.entity';

const AGENDA_VERSION = 1;

@Injectable()
export class YearlyAiService {
  constructor(
    @InjectRepository(YearlyAiCache)
    private readonly repo: Repository<YearlyAiCache>,
  ) {}

  async findCache(
    year: number,
    familyId: string,
  ): Promise<YearlyAiCache | null> {
    const found = await this.repo.findOne({ where: { year, familyId } });
    if (!found) return null;
    if (found.version !== AGENDA_VERSION) return null;
    return found;
  }

  async ensureCache(year: number, familyId: string): Promise<YearlyAiCache> {
    const fresh = await this.findCache(year, familyId);
    if (fresh) return fresh;
    return this.regenerate(year, familyId);
  }

  async regenerate(year: number, familyId: string): Promise<YearlyAiCache> {
    const items = buildYearlyAgenda(year);
    await this.repo.upsert(
      {
        familyId,
        year,
        items,
        version: AGENDA_VERSION,
        generatedAt: new Date(),
      },
      { conflictPaths: ['familyId', 'year'] },
    );
    const saved = await this.repo.findOne({ where: { year, familyId } });
    if (!saved)
      throw new Error('yearly_ai_dates_cache row missing after upsert');
    return saved;
  }
}
