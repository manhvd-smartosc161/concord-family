import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EmailService } from '../../shared/notifications/email.service';
import { Family } from './entities/family.entity';
import { FamilyInvitation } from './entities/family-invitation.entity';
import { User } from '../users/entities/user.entity';
import { Fund } from '../funds/entities/fund.entity';
import { Category } from '../categories/entities/category.entity';
import { ImportantDate } from '../important-dates/entities/important-date.entity';
import { DEFAULT_CATEGORIES } from './default-categories';
import { CreateFamilyDto } from './dto/create-family.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { UpdateFamilyDto } from './dto/update-family.dto';

const INVITATION_TTL_DAYS = 7;
const MAX_FAMILY_SIZE = 2;

@Injectable()
export class FamiliesService {
  private readonly logger = new Logger(FamiliesService.name);

  constructor(
    @InjectRepository(Family) private readonly familyRepo: Repository<Family>,
    @InjectRepository(FamilyInvitation)
    private readonly invitationRepo: Repository<FamilyInvitation>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Fund) private readonly fundRepo: Repository<Fund>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(ImportantDate)
    private readonly importantDateRepo: Repository<ImportantDate>,
    private readonly dataSource: DataSource,
    private readonly email: EmailService,
  ) {}

  async leaveFamily(user: User): Promise<void> {
    if (!user.familyId) {
      throw new BadRequestException('Bạn không ở trong gia đình nào.');
    }
    const familyId = user.familyId;

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(Fund, {
        familyId,
        ownerId: user.id,
        type: 'personal',
      });
      await manager.query(
        `DELETE FROM "salary_rules" WHERE "user_id" = $1 AND "family_id" = $2`,
        [user.id, familyId],
      );
      await manager.update(
        User,
        { id: user.id },
        { familyId: null, role: null },
      );
      const remaining = await manager.count(User, { where: { familyId } });
      if (remaining === 0) {
        await manager.delete(Family, { id: familyId });
      } else {
        await manager.update(Family, { id: familyId }, { completedAt: null });
      }
    });

    user.familyId = null;
    user.role = null;
  }

  async createForUser(user: User, dto: CreateFamilyDto): Promise<Family> {
    if (user.familyId)
      throw new ConflictException('Bạn đã ở trong một gia đình.');
    const family = await this.familyRepo.save(
      this.familyRepo.create({
        name: dto.name,
        weddingDate: dto.weddingDate ?? null,
        createdById: user.id,
      }),
    );
    user.familyId = family.id;
    user.role = user.gender === 'male' ? 'husband' : 'wife';
    await this.userRepo.save(user);
    return family;
  }

  async getCurrent(user: User): Promise<{ family: Family; members: User[] }> {
    if (!user.familyId)
      throw new NotFoundException('Bạn chưa ở trong gia đình nào.');
    const family = await this.familyRepo.findOneByOrFail({ id: user.familyId });
    const members = await this.userRepo.findBy({ familyId: family.id });
    return { family, members };
  }

  async updateFamily(user: User, dto: UpdateFamilyDto): Promise<Family> {
    if (!user.familyId)
      throw new ForbiddenException('Bạn chưa ở trong gia đình nào.');
    const family = await this.familyRepo.findOneByOrFail({ id: user.familyId });
    if (dto.name !== undefined) family.name = dto.name;
    if (dto.weddingDate !== undefined) {
      family.weddingDate = dto.weddingDate
        ? dto.weddingDate.slice(0, 10)
        : null;
    }
    if (dto.financialMonthCutoffDay !== undefined) {
      family.financialMonthCutoffDay = dto.financialMonthCutoffDay;
    }
    return this.familyRepo.save(family);
  }

  async createInvitation(
    user: User,
    dto: CreateInvitationDto,
  ): Promise<{
    id: string;
    email: string;
    token: string;
    link: string;
    expiresAt: Date;
  }> {
    if (!user.familyId)
      throw new ForbiddenException('Bạn cần ở trong gia đình.');
    const members = await this.userRepo.findBy({ familyId: user.familyId });
    if (members.length >= MAX_FAMILY_SIZE)
      throw new BadRequestException('Gia đình đã đủ thành viên.');

    await this.invitationRepo
      .createQueryBuilder()
      .delete()
      .where('family_id = :familyId AND accepted_at IS NULL', {
        familyId: user.familyId,
      })
      .execute();

    const token = randomUUID();
    const expiresAt = new Date(
      Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
    const invitation = await this.invitationRepo.save(
      this.invitationRepo.create({
        familyId: user.familyId,
        createdById: user.id,
        email: dto.email,
        token,
        expiresAt,
      }),
    );

    const baseUrl = process.env.WEB_BASE_URL ?? 'http://localhost:3000';
    const link = `${baseUrl}/invite/${token}`;
    this.logger.log(`Invitation created for ${dto.email}: ${link}`);

    const family = await this.familyRepo.findOneByOrFail({
      id: user.familyId,
    });
    const subject = `${user.name} mời bạn tham gia gia đình "${family.name}" trên Concord`;
    const text = [
      `Chào,`,
      ``,
      `${user.name} (${user.email}) muốn bạn tham gia gia đình "${family.name}" trên Concord — app quản lý tài chính cho cặp đôi.`,
      ``,
      `Mở link sau để chấp nhận:`,
      link,
      ``,
      `Link có hiệu lực 7 ngày. Nếu bạn không biết người mời, có thể bỏ qua email này.`,
      ``,
      `— Concord`,
    ].join('\n');
    const html = renderInvitationHtml({
      inviterName: user.name,
      inviterEmail: user.email,
      familyName: family.name,
      link,
    });

    void this.email
      .send(dto.email, { subject, text, html })
      .catch((err) =>
        this.logger.warn(
          `Email send failed for invitation ${invitation.id}: ${(err as Error).message}`,
        ),
      );

    return {
      id: invitation.id,
      email: invitation.email,
      token: invitation.token,
      link,
      expiresAt: invitation.expiresAt,
    };
  }

  async getInvitationByToken(token: string): Promise<{
    invitation: { token: string; email: string; expiresAt: Date };
    family: Family;
    inviter: { name: string };
  }> {
    const invitation = await this.invitationRepo.findOneBy({ token });
    if (!invitation) throw new NotFoundException('Link mời không hợp lệ.');
    if (invitation.acceptedAt)
      throw new BadRequestException('Link đã được dùng.');
    if (invitation.expiresAt < new Date())
      throw new BadRequestException('Link đã hết hạn.');
    const family = await this.familyRepo.findOneByOrFail({
      id: invitation.familyId,
    });
    const inviter = await this.userRepo.findOneByOrFail({
      id: invitation.createdById,
    });
    return {
      invitation: {
        token: invitation.token,
        email: invitation.email,
        expiresAt: invitation.expiresAt,
      },
      family,
      inviter: { name: inviter.name },
    };
  }

  async acceptInvitation(user: User, token: string): Promise<Family> {
    const invitation = await this.invitationRepo.findOneBy({ token });
    if (!invitation) throw new NotFoundException('Link mời không hợp lệ.');
    if (invitation.acceptedAt)
      throw new BadRequestException('Link đã được dùng.');
    if (invitation.expiresAt < new Date())
      throw new BadRequestException('Link đã hết hạn.');
    if (user.familyId)
      throw new ConflictException('Bạn đã ở trong một gia đình.');

    const members = await this.userRepo.findBy({
      familyId: invitation.familyId,
    });
    if (members.length >= MAX_FAMILY_SIZE)
      throw new BadRequestException('Gia đình đã đủ thành viên.');

    user.familyId = invitation.familyId;
    const existingRoles = members.map((m) => m.role).filter(Boolean);
    if (existingRoles.includes('husband')) {
      user.role = 'wife';
    } else if (existingRoles.includes('wife')) {
      user.role = 'husband';
    } else {
      user.role = user.gender === 'male' ? 'husband' : 'wife';
    }
    await this.userRepo.save(user);

    invitation.acceptedAt = new Date();
    invitation.acceptedById = user.id;
    await this.invitationRepo.save(invitation);

    await this.completeIfReady(invitation.familyId);

    return this.familyRepo.findOneByOrFail({ id: invitation.familyId });
  }

  async completeIfReady(familyId: string): Promise<void> {
    const family = await this.familyRepo.findOneByOrFail({ id: familyId });
    const members = await this.userRepo.findBy({ familyId });
    if (members.length < 2) return;

    const husband = members.find((m) => m.role === 'husband') ?? members[0];
    const wife = members.find((m) => m.role === 'wife') ?? members[1];

    const existingFunds = await this.fundRepo.find({ where: { familyId } });
    const hasJoint = existingFunds.some(
      (f) => f.type === 'joint' && f.purpose === 'spending',
    );
    const hasHusbandFund = existingFunds.some(
      (f) =>
        f.type === 'personal' &&
        f.purpose === 'spending' &&
        f.ownerId === husband.id,
    );
    const hasWifeFund = existingFunds.some(
      (f) =>
        f.type === 'personal' &&
        f.purpose === 'spending' &&
        f.ownerId === wife.id,
    );

    const fundsToCreate: Partial<Fund>[] = [];
    if (!hasHusbandFund) {
      fundsToCreate.push({
        familyId,
        name: `Quỹ ${husband.name}`,
        type: 'personal',
        purpose: 'spending',
        ownerId: husband.id,
        balance: 0,
        displayOrder: 0,
      });
    }
    if (!hasWifeFund) {
      fundsToCreate.push({
        familyId,
        name: `Quỹ ${wife.name}`,
        type: 'personal',
        purpose: 'spending',
        ownerId: wife.id,
        balance: 0,
        displayOrder: 1,
      });
    }
    if (!hasJoint) {
      fundsToCreate.push({
        familyId,
        name: 'Quỹ Chung',
        type: 'joint',
        purpose: 'spending',
        ownerId: null,
        balance: 0,
        displayOrder: 2,
      });
    }
    if (fundsToCreate.length > 0) {
      await this.fundRepo.save(fundsToCreate);
    }

    const existingCategoriesCount = await this.categoryRepo.count({
      where: { familyId },
    });
    if (existingCategoriesCount === 0) {
      for (const seed of DEFAULT_CATEGORIES) {
        const parent = await this.categoryRepo.save(
          this.categoryRepo.create({
            familyId,
            name: seed.name,
            icon: seed.icon ?? null,
            color: null,
            isEssential: seed.isEssential,
            parentId: null,
          }),
        );
        for (const child of seed.children ?? []) {
          await this.categoryRepo.save(
            this.categoryRepo.create({
              familyId,
              name: child.name,
              icon: child.icon ?? null,
              color: null,
              isEssential: seed.isEssential,
              parentId: parent.id,
            }),
          );
        }
      }
    }

    const existingImportantDatesCount = await this.importantDateRepo.count({
      where: { familyId },
    });
    if (existingImportantDatesCount === 0) {
      const importantDates: Partial<ImportantDate>[] = [];
      if (husband.birthdate) {
        importantDates.push({
          familyId,
          name: `Sinh nhật ${husband.name}`,
          type: 'birthday',
          date: husband.birthdate,
          isLunar: false,
          remindDaysBefore: [0, 7],
          notes: null,
          createdById: husband.id,
        });
      }
      if (wife.birthdate) {
        importantDates.push({
          familyId,
          name: `Sinh nhật ${wife.name}`,
          type: 'birthday',
          date: wife.birthdate,
          isLunar: false,
          remindDaysBefore: [0, 7],
          notes: null,
          createdById: wife.id,
        });
      }
      if (family.weddingDate) {
        importantDates.push({
          familyId,
          name: 'Kỷ niệm cưới',
          type: 'anniversary',
          date: family.weddingDate,
          isLunar: false,
          remindDaysBefore: [0, 7],
          notes: null,
          createdById: family.createdById,
        });
      }
      if (importantDates.length > 0) {
        await this.importantDateRepo.save(importantDates);
      }
    }

    if (!family.completedAt) {
      family.completedAt = new Date();
      await this.familyRepo.save(family);
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderInvitationHtml(opts: {
  inviterName: string;
  inviterEmail: string;
  familyName: string;
  link: string;
}): string {
  const inviterName = escapeHtml(opts.inviterName);
  const inviterEmail = escapeHtml(opts.inviterEmail);
  const familyName = escapeHtml(opts.familyName);
  const link = opts.link;
  return `<!doctype html>
<html lang="vi">
  <body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1c1917">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f4;padding:32px 16px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid #e7e5e4;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04)">
            <tr>
              <td style="height:6px;background:linear-gradient(90deg,#047857,#10b981,#34d399);"></td>
            </tr>
            <tr>
              <td style="padding:32px 32px 8px 32px">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="vertical-align:middle">
                      <div style="width:36px;height:36px;border-radius:10px;background:#047857;color:#ffffff;font-weight:700;text-align:center;line-height:36px;font-size:16px">C</div>
                    </td>
                    <td style="vertical-align:middle;padding-left:10px">
                      <div style="font-weight:600;font-size:14px;color:#1c1917">Concord</div>
                      <div style="font-size:11px;color:#a8a29e;letter-spacing:0.04em">COUPLE FINANCE</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 8px 32px">
                <div style="display:inline-block;background:#ecfdf5;color:#047857;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;padding:4px 10px;border-radius:999px">Lời mời</div>
                <h1 style="margin:14px 0 8px 0;font-size:22px;font-weight:600;color:#1c1917;line-height:1.3">Tham gia gia đình ${familyName}</h1>
                <p style="margin:0;color:#57534e;font-size:14px;line-height:1.6">
                  <strong style="color:#1c1917">${inviterName}</strong>
                  <span style="color:#a8a29e">&lt;${inviterEmail}&gt;</span>
                  mời bạn tham gia gia đình
                  <strong style="color:#1c1917">${familyName}</strong>
                  để cùng quản lý tài chính chung trên Concord.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 8px 32px" align="center">
                <a href="${link}" style="display:inline-block;background:#047857;color:#ffffff;text-decoration:none;font-weight:500;font-size:14px;padding:13px 28px;border-radius:10px">
                  Chấp nhận lời mời →
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px 32px" align="center">
                <p style="margin:0;color:#a8a29e;font-size:11px">
                  Link có hiệu lực 7 ngày
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px">
                <hr style="border:none;border-top:1px solid #f5f5f4;margin:0">
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px">
                <div style="font-size:11px;color:#a8a29e;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;margin-bottom:8px">Hoặc copy link</div>
                <a href="${link}" style="display:block;background:#fafaf9;border:1px solid #e7e5e4;border-radius:8px;padding:10px 12px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:11px;color:#44403c;text-decoration:none;word-break:break-all">${link}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 28px 32px">
                <p style="margin:0;color:#a8a29e;font-size:11px;line-height:1.5">
                  Nếu bạn không biết người mời, có thể bỏ qua email này — tài khoản của bạn không bị ảnh hưởng.
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0 0;color:#a8a29e;font-size:11px;text-align:center">
            © Concord · couple finance agent
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
