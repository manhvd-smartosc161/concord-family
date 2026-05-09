import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalaryRule } from './entities/salary-rule.entity';
import { User } from '../users/entities/user.entity';

export interface SalaryRuleView {
  id: string;
  pctToPersonal: number;
  pctToJoint: number;
  fixedAmountToJoint: number | null;
}

export interface UpdateSalaryRuleDto {
  pctToPersonal: number;
  pctToJoint: number;
  fixedAmountToJoint: number | null;
}

@Injectable()
export class SalaryRulesService {
  constructor(
    @InjectRepository(SalaryRule)
    private readonly repo: Repository<SalaryRule>,
  ) {}

  async findForUser(user: User): Promise<SalaryRuleView> {
    const rule = await this.repo.findOne({
      where: { familyId: user.familyId!, userId: user.id },
    });
    if (!rule) throw new NotFoundException('Chưa thiết lập rule lương');
    return this.toView(rule);
  }

  async updateForUser(
    user: User,
    dto: UpdateSalaryRuleDto,
  ): Promise<SalaryRuleView> {
    if (dto.pctToPersonal + dto.pctToJoint !== 100) {
      throw new BadRequestException(
        `Tỉ lệ phải tổng bằng 100 (hiện ${dto.pctToPersonal} + ${dto.pctToJoint})`,
      );
    }
    if (dto.pctToPersonal < 0 || dto.pctToJoint < 0) {
      throw new BadRequestException('Tỉ lệ không thể âm');
    }
    if (
      dto.fixedAmountToJoint !== null &&
      dto.fixedAmountToJoint !== undefined &&
      dto.fixedAmountToJoint < 0
    ) {
      throw new BadRequestException('Số cố định không thể âm');
    }
    const rule = await this.repo.findOne({
      where: { familyId: user.familyId!, userId: user.id },
    });
    if (!rule) throw new NotFoundException('Chưa thiết lập rule lương');
    rule.pctToPersonal = dto.pctToPersonal;
    rule.pctToJoint = dto.pctToJoint;
    rule.fixedAmountToJoint = dto.fixedAmountToJoint ?? null;
    const saved = await this.repo.save(rule);
    return this.toView(saved);
  }

  private toView(r: SalaryRule): SalaryRuleView {
    return {
      id: r.id,
      pctToPersonal: r.pctToPersonal,
      pctToJoint: r.pctToJoint,
      fixedAmountToJoint: r.fixedAmountToJoint,
    };
  }
}
