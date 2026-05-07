import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { Category } from '../categories/entities/category.entity';
import { Fund } from '../funds/entities/fund.entity';
import { OPENING_BALANCE_NOTE } from '../funds/opening-balance.constants';
import type { LogTransactionInput } from '../../agent/subagents/parser/parser.tools';
import { User } from '../users/entities/user.entity';
import type { UpdateTransactionDto } from './dto/update-transaction.dto';
import { Transaction } from './entities/transaction.entity';

export interface AgentLogResult {
  txn: Transaction;
  fund: Fund;
  category: Category | null;
}

export interface TransactionView {
  id: string;
  date: string;
  amount: number;
  note: string | null;
  source: string;
  fund: { id: string; name: string; type: 'personal' | 'joint' };
  category: { id: string; name: string; icon: string | null } | null;
  loggedBy: { id: string; name: string };
}

function toTransactionView(t: Transaction): TransactionView {
  return {
    id: t.id,
    date: t.date.toISOString(),
    amount: t.amount,
    note: t.note,
    source: t.source,
    fund: { id: t.fund.id, name: t.fund.name, type: t.fund.type },
    category: t.category
      ? { id: t.category.id, name: t.category.name, icon: t.category.icon }
      : null,
    loggedBy: { id: t.user.id, name: t.user.name },
  };
}

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly txnRepo: Repository<Transaction>,
    @InjectRepository(Fund)
    private readonly fundRepo: Repository<Fund>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Insert a transaction emitted by the Parser subagent. Validates fund access
   * (user must own the fund OR fund must be joint), atomically inserts the
   * txn and adjusts the fund balance.
   */
  async createFromAgent(
    input: LogTransactionInput,
    user: User,
    rawText: string,
  ): Promise<AgentLogResult> {
    const fund = await this.fundRepo.findOneBy({ name: input.fundName });
    if (!fund) {
      throw new BadRequestException(
        `Fund "${input.fundName}" không tồn tại. Quỹ hợp lệ: Quỹ Mạnh, Quỹ Vợ, Quỹ Chung.`,
      );
    }
    if (fund.type === 'personal' && fund.ownerId !== user.id) {
      throw new ForbiddenException(
        `${user.name} không thể ghi vào ${fund.name} (đó là quỹ riêng của người khác).`,
      );
    }
    if (!Number.isFinite(input.amount) || input.amount === 0) {
      throw new BadRequestException(
        `Số tiền không hợp lệ: ${input.amount}. Phải là số khác 0 (âm = chi, dương = thu).`,
      );
    }

    const category = await this.resolveCategory(input.categoryName);

    return this.dataSource.transaction(async (manager) => {
      const created = manager.create(Transaction, {
        userId: user.id,
        fundId: fund.id,
        categoryId: category?.id ?? null,
        amount: input.amount,
        note: input.note ?? null,
        rawText,
        source: 'chat',
        date: input.date ? new Date(input.date) : new Date(),
      });
      const saved = await manager.save(created);
      await manager.increment(Fund, { id: fund.id }, 'balance', input.amount);
      const updatedFund = await manager.findOneByOrFail(Fund, { id: fund.id });

      this.logger.log(
        `📝 ${user.name}: ${input.amount > 0 ? '+' : ''}${input.amount.toLocaleString('vi-VN')}đ ` +
          `→ ${updatedFund.name} (${category?.name ?? 'no category'})`,
      );

      return { txn: saved, fund: updatedFund, category };
    });
  }

  /**
   * Edit an existing transaction. If `fundId` or `amount` change, both old and
   * new fund balances are recomputed atomically:
   *   oldFund.balance -= oldAmount
   *   newFund.balance += newAmount
   * (Same fund + same amount → balance unchanged.)
   */
  async updateForUser(
    txnId: string,
    user: User,
    dto: UpdateTransactionDto,
  ): Promise<TransactionView> {
    const txn = await this.txnRepo.findOne({
      where: { id: txnId },
      relations: { fund: true, category: true, user: true },
    });
    if (!txn) throw new NotFoundException('Giao dịch không tồn tại');

    // User must currently own the txn's fund
    if (txn.fund.type === 'personal' && txn.fund.ownerId !== user.id) {
      throw new ForbiddenException(
        `Không thể edit giao dịch ở quỹ riêng của người khác`,
      );
    }

    // Resolve new fund (if changed)
    let newFund = txn.fund;
    if (dto.fundId && dto.fundId !== txn.fundId) {
      const candidate = await this.fundRepo.findOneBy({ id: dto.fundId });
      if (!candidate) throw new BadRequestException('Quỹ đích không tồn tại');
      if (candidate.type === 'personal' && candidate.ownerId !== user.id) {
        throw new ForbiddenException(
          `Không thể chuyển sang ${candidate.name} (quỹ riêng của người khác)`,
        );
      }
      newFund = candidate;
    }

    // Resolve new category (if changed; null = uncategorize)
    let newCategoryId: string | null = txn.categoryId;
    if (dto.categoryId !== undefined) {
      if (dto.categoryId === null) {
        newCategoryId = null;
      } else {
        const cat = await this.categoryRepo.findOneBy({ id: dto.categoryId });
        if (!cat) throw new BadRequestException('Category không tồn tại');
        newCategoryId = cat.id;
      }
    }

    const newAmount = dto.amount ?? txn.amount;
    if (newAmount === 0) {
      throw new BadRequestException('Số tiền không thể bằng 0');
    }
    const newNote = dto.note !== undefined ? dto.note : txn.note;

    return this.dataSource.transaction(async (manager) => {
      // Reverse old, apply new
      if (newFund.id !== txn.fundId) {
        await manager.decrement(
          Fund,
          { id: txn.fundId },
          'balance',
          txn.amount,
        );
        await manager.increment(Fund, { id: newFund.id }, 'balance', newAmount);
      } else if (newAmount !== txn.amount) {
        await manager.increment(
          Fund,
          { id: txn.fundId },
          'balance',
          newAmount - txn.amount,
        );
      }

      // Use explicit UPDATE — `manager.save(entity)` can be flaky when both
      // the relation property and FK column are touched at once.
      await manager.update(
        Transaction,
        { id: txn.id },
        {
          fundId: newFund.id,
          amount: newAmount,
          categoryId: newCategoryId,
          note: newNote,
        },
      );

      const reloaded = await manager.findOneOrFail(Transaction, {
        where: { id: txn.id },
        relations: { fund: true, category: true, user: true },
      });
      return toTransactionView(reloaded);
    });
  }

  /**
   * Tương tự updateForUser nhưng nhận tên (fundName/categoryName) thay vì id —
   * tiện cho agent vì model chỉ thấy tên trong context. Tự resolve về id rồi
   * delegate cho updateForUser.
   */
  async updateFromAgent(
    txnId: string,
    user: User,
    patch: {
      fundName?: string;
      amount?: number;
      categoryName?: string;
      note?: string;
    },
  ): Promise<TransactionView> {
    const dto: UpdateTransactionDto = {};

    if (patch.fundName !== undefined) {
      const fund = await this.fundRepo.findOneBy({ name: patch.fundName });
      if (!fund) {
        throw new BadRequestException(
          `Fund "${patch.fundName}" không tồn tại. Quỹ hợp lệ: Quỹ Mạnh, Quỹ Vợ, Quỹ Chung.`,
        );
      }
      dto.fundId = fund.id;
    }

    if (patch.amount !== undefined) dto.amount = patch.amount;

    if (patch.categoryName !== undefined) {
      if (patch.categoryName === '') {
        dto.categoryId = null;
      } else {
        const cat = await this.resolveCategory(patch.categoryName);
        if (!cat) {
          throw new BadRequestException(
            `Category "${patch.categoryName}" không khớp với category nào.`,
          );
        }
        dto.categoryId = cat.id;
      }
    }

    if (patch.note !== undefined) {
      dto.note = patch.note === '' ? null : patch.note;
    }

    return this.updateForUser(txnId, user, dto);
  }

  /**
   * Reverse a transaction (admin/cleanup): rollback the balance change and
   * delete the row. User must own the fund (own personal OR joint).
   */
  async deleteForUser(txnId: string, user: User): Promise<void> {
    const txn = await this.txnRepo.findOne({
      where: { id: txnId },
      relations: { fund: true },
    });
    if (!txn) throw new NotFoundException('Giao dịch không tồn tại');

    const fund = txn.fund;
    if (fund.type === 'personal' && fund.ownerId !== user.id) {
      throw new ForbiddenException(
        `Không thể xoá giao dịch ở quỹ riêng của người khác`,
      );
    }

    await this.dataSource.transaction(async (manager) => {
      // Reverse balance: if amount was -200000, decrement by amount = -(-200000)
      // → balance += 200000 (refund the expense). For income, balance -= amount.
      await manager.decrement(Fund, { id: fund.id }, 'balance', txn.amount);
      await manager.delete(Transaction, { id: txn.id });
    });
    this.logger.log(
      `🗑️  ${user.name} deleted txn ${txnId.slice(0, 8)} (${txn.amount.toLocaleString('vi-VN')}đ from ${fund.name})`,
    );
  }

  /**
   * IDs of funds the user can read: their personal + joint.
   * (Spouse's personal fund is excluded — same as write rule.)
   */
  async visibleFundIds(user: User): Promise<string[]> {
    const funds = await this.fundRepo.find({
      where: [{ ownerId: user.id }, { ownerId: IsNull() }],
    });
    return funds.map((f) => f.id);
  }

  /** Recent transactions visible to the user, joined with fund + category. */
  async recentForUser(user: User, limit = 20): Promise<TransactionView[]> {
    const fundIds = await this.visibleFundIds(user);
    if (fundIds.length === 0) return [];

    const rows = await this.txnRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.fund', 'fund')
      .leftJoinAndSelect('t.category', 'category')
      .leftJoinAndSelect('t.user', 'user')
      .where('t.fund_id IN (:...fundIds)', { fundIds })
      .andWhere('(t.note IS NULL OR t.note <> :marker)', {
        marker: OPENING_BALANCE_NOTE,
      })
      .orderBy('t.date', 'DESC')
      .take(Math.min(limit, 100))
      .getMany();

    return rows.map(toTransactionView);
  }

  /**
   * Filtered + paginated list. Caller can narrow by fund, date range, or
   * full-text search on note. Privacy is enforced — fundId not in user's
   * visible set is silently dropped.
   */
  async listForUser(
    user: User,
    filters: {
      fundId?: string;
      from?: Date;
      to?: Date;
      q?: string;
      offset?: number;
      limit?: number;
    },
  ): Promise<{ items: TransactionView[]; total: number }> {
    const visible = await this.visibleFundIds(user);
    if (visible.length === 0) return { items: [], total: 0 };

    let fundIds = visible;
    if (filters.fundId) {
      fundIds = visible.includes(filters.fundId) ? [filters.fundId] : [];
    }
    if (fundIds.length === 0) return { items: [], total: 0 };

    const qb = this.txnRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.fund', 'fund')
      .leftJoinAndSelect('t.category', 'category')
      .leftJoinAndSelect('t.user', 'user')
      .where('t.fund_id IN (:...fundIds)', { fundIds })
      .andWhere('(t.note IS NULL OR t.note <> :marker)', {
        marker: OPENING_BALANCE_NOTE,
      });

    if (filters.from) qb.andWhere('t.date >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('t.date <= :to', { to: filters.to });
    if (filters.q && filters.q.trim()) {
      qb.andWhere(
        '(t.note ILIKE :q OR t.raw_text ILIKE :q OR category.name ILIKE :q)',
        { q: `%${filters.q.trim()}%` },
      );
    }

    qb.orderBy('t.date', 'DESC').addOrderBy('t.createdAt', 'DESC');

    const total = await qb.getCount();
    const offset = Math.max(0, filters.offset ?? 0);
    const limit = Math.min(200, Math.max(1, filters.limit ?? 50));
    qb.skip(offset).take(limit);

    const rows = await qb.getMany();
    return { items: rows.map(toTransactionView), total };
  }

  /** Last N txns user vừa log (để agent biết id khi cần update/delete). */
  async lastLoggedByUser(userId: string, limit = 5): Promise<Transaction[]> {
    return this.txnRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.fund', 'fund')
      .leftJoinAndSelect('t.category', 'category')
      .where('t.user_id = :userId', { userId })
      .andWhere('(t.note IS NULL OR t.note <> :marker)', {
        marker: OPENING_BALANCE_NOTE,
      })
      .orderBy('t.createdAt', 'DESC')
      .take(Math.max(1, Math.min(limit, 20)))
      .getMany();
  }

  /** Best-effort fuzzy match — exact (case-insensitive), then ILIKE %name%. */
  private async resolveCategory(name?: string): Promise<Category | null> {
    if (!name) return null;
    const trimmed = name.trim();
    if (!trimmed) return null;

    const exact = await this.categoryRepo
      .createQueryBuilder('c')
      .where('LOWER(c.name) = LOWER(:n)', { n: trimmed })
      .getOne();
    if (exact) return exact;

    const partial = await this.categoryRepo
      .createQueryBuilder('c')
      .where('c.name ILIKE :n', { n: `%${trimmed}%` })
      .orderBy('LENGTH(c.name)', 'ASC') // prefer shorter (more specific) matches
      .getOne();
    return partial;
  }
}
