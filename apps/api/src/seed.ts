/**
 * Idempotent seed: 2 users (vợ + chồng), 3 funds, VN category tree, default
 * goal (tiết kiệm 150tr/năm), default 70/30 salary rules.
 *
 * Run: `pnpm --filter api seed`
 */
import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { IsNull } from 'typeorm';
import { AppDataSource } from './data-source';
import { Category } from './categories/entities/category.entity';
import { Fund } from './funds/entities/fund.entity';
import { Goal } from './goals/entities/goal.entity';
import { SalaryRule } from './users/entities/salary-rule.entity';
import { User } from './users/entities/user.entity';

const HUSBAND_EMAIL = 'manh@concord.local';
const WIFE_EMAIL = 'wife@concord.local';
// Dev-only default passwords. Change these once auth is wired up.
const HUSBAND_PASSWORD = 'concord-manh';
const WIFE_PASSWORD = 'concord-wife';

interface CategorySeed {
  name: string;
  icon: string;
  children: Array<{ name: string; icon: string }>;
}

const ESSENTIAL_TREE: CategorySeed[] = [
  {
    name: 'Ăn uống',
    icon: '🍜',
    children: [
      { name: 'Ăn ngoài', icon: '🍽️' },
      { name: 'Cà phê / Trà sữa', icon: '☕' },
      { name: 'Đi chợ / Siêu thị', icon: '🛒' },
    ],
  },
  {
    name: 'Đi lại',
    icon: '🚗',
    children: [
      { name: 'Xăng', icon: '⛽' },
      { name: 'Grab / Taxi', icon: '🚕' },
      { name: 'Bảo dưỡng xe', icon: '🔧' },
    ],
  },
  {
    name: 'Nhà cửa',
    icon: '🏠',
    children: [
      { name: 'Tiền nhà / Điện nước', icon: '💡' },
      { name: 'Internet / Điện thoại', icon: '📡' },
      { name: 'Sửa chữa', icon: '🔨' },
    ],
  },
  {
    name: 'Con cái',
    icon: '👶',
    children: [
      { name: 'Sữa / Bỉm', icon: '🍼' },
      { name: 'Học phí', icon: '📚' },
      { name: 'Đồ chơi / Sách', icon: '🧸' },
      { name: 'Khám sức khỏe', icon: '💊' },
    ],
  },
  {
    name: 'Sức khỏe',
    icon: '💪',
    children: [
      { name: 'Khám / Thuốc', icon: '🏥' },
      { name: 'Tập gym / Thể thao', icon: '🏋️' },
    ],
  },
];

const NON_ESSENTIAL_TREE: CategorySeed[] = [
  // Internal transfer between funds (eg "đưa vợ tiền lương" = góp quỹ chung).
  // Reports/goals filter this out — it's not real income or expense.
  {
    name: 'Chuyển nội bộ',
    icon: '🔄',
    children: [],
  },
  {
    name: 'Mua sắm',
    icon: '🛍️',
    children: [
      { name: 'Quần áo', icon: '👕' },
      { name: 'Đồ điện tử', icon: '📱' },
      { name: 'Mỹ phẩm', icon: '💄' },
    ],
  },
  {
    name: 'Giải trí',
    icon: '🎬',
    children: [
      { name: 'Du lịch', icon: '✈️' },
      { name: 'Phim / Game', icon: '🎮' },
      { name: 'Hội hè / Cưới hỏi', icon: '🎉' },
    ],
  },
  {
    name: 'Cá nhân',
    icon: '💼',
    children: [
      { name: 'Học hành', icon: '📖' },
      { name: 'Quà tặng', icon: '🎁' },
    ],
  },
  {
    name: 'Thu nhập',
    icon: '💰',
    children: [
      { name: 'Lương', icon: '💵' },
      { name: 'Thưởng', icon: '🏅' },
      { name: 'Freelance / Khác', icon: '🪙' },
    ],
  },
];

async function ensureUser(
  email: string,
  data: { name: string; role: 'husband' | 'wife'; password: string },
): Promise<User> {
  const repo = AppDataSource.getRepository(User);
  let user = await repo.findOneBy({ email });
  if (user) return user;
  user = repo.create({
    email,
    name: data.name,
    role: data.role,
    hashedPassword: await bcrypt.hash(data.password, 10),
  });
  return repo.save(user);
}

async function ensureFund(
  name: string,
  type: 'personal' | 'joint',
  ownerId: string | null,
): Promise<Fund> {
  const repo = AppDataSource.getRepository(Fund);
  let fund = await repo.findOneBy({ name });
  if (fund) return fund;
  fund = repo.create({ name, type, ownerId, balance: 0 });
  return repo.save(fund);
}

async function ensureCategoryTree(
  trees: CategorySeed[],
  isEssential: boolean,
): Promise<void> {
  const repo = AppDataSource.getRepository(Category);
  for (const top of trees) {
    let parent = await repo.findOne({
      where: { name: top.name, parentId: IsNull() },
    });
    if (!parent) {
      parent = await repo.save(
        repo.create({
          name: top.name,
          icon: top.icon,
          isEssential,
          parentId: null,
        }),
      );
    }
    for (const child of top.children) {
      const exists = await repo.findOne({
        where: { name: child.name, parentId: parent.id },
      });
      if (!exists) {
        await repo.save(
          repo.create({
            name: child.name,
            icon: child.icon,
            isEssential,
            parentId: parent.id,
          }),
        );
      }
    }
  }
}

async function ensureCoupleSavingsGoal(): Promise<void> {
  const repo = AppDataSource.getRepository(Goal);
  const existing = await repo.findOne({
    where: { userId: IsNull(), period: 'year', type: 'save' },
  });
  if (existing) return;
  const year = new Date().getFullYear();
  await repo.save(
    repo.create({
      userId: null,
      targetAmount: 150_000_000, // 150tr — middle of the 100-200tr target band
      period: 'year',
      type: 'save',
      startDate: `${year}-01-01`,
      deadline: `${year}-12-31`,
    }),
  );
}

async function ensureSalaryRule(userId: string): Promise<void> {
  const repo = AppDataSource.getRepository(SalaryRule);
  const existing = await repo.findOne({ where: { userId } });
  if (existing) return;
  await repo.save(
    repo.create({
      userId,
      pctToPersonal: 70,
      pctToJoint: 30,
      fixedAmountToJoint: null,
    }),
  );
}

async function main(): Promise<void> {
  await AppDataSource.initialize();
  console.log('🌱 Seeding Concord…');

  const husband = await ensureUser(HUSBAND_EMAIL, {
    name: 'Mạnh',
    role: 'husband',
    password: HUSBAND_PASSWORD,
  });
  const wife = await ensureUser(WIFE_EMAIL, {
    name: 'Vợ',
    role: 'wife',
    password: WIFE_PASSWORD,
  });
  console.log(`  ✅ Users: ${husband.name}, ${wife.name}`);

  await ensureFund('Quỹ Mạnh', 'personal', husband.id);
  await ensureFund('Quỹ Vợ', 'personal', wife.id);
  await ensureFund('Quỹ Chung', 'joint', null);
  console.log(`  ✅ Funds: Quỹ Mạnh, Quỹ Vợ, Quỹ Chung`);

  await ensureCategoryTree(ESSENTIAL_TREE, true);
  await ensureCategoryTree(NON_ESSENTIAL_TREE, false);
  const cnt = await AppDataSource.getRepository(Category).count();
  console.log(`  ✅ Categories: ${cnt} rows`);

  await ensureCoupleSavingsGoal();
  console.log(`  ✅ Goal: tiết kiệm 150tr/năm`);

  await ensureSalaryRule(husband.id);
  await ensureSalaryRule(wife.id);
  console.log(`  ✅ Salary rules: 70% cá nhân / 30% quỹ chung cho cả 2`);

  await AppDataSource.destroy();
  console.log('🎉 Seed complete!');
  console.log('');
  console.log('Login credentials (dev only — CHANGE BEFORE PRODUCTION):');
  console.log(`  ${HUSBAND_EMAIL}  /  ${HUSBAND_PASSWORD}`);
  console.log(`  ${WIFE_EMAIL}     /  ${WIFE_PASSWORD}`);
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
