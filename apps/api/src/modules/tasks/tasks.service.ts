import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnthropicService } from '../../agent/core/anthropic.service';
import { FamilyEventsNotifier } from '../../shared/notifications/family-events.service';
import { User } from '../users/entities/user.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task, TaskCategory } from './entities/task.entity';

function isoWeekYear(date: Date): string {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function currentWeekYear(): string {
  return isoWeekYear(
    new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }),
    ),
  );
}

function addWeeks(weekYear: string, delta: number): string {
  const [year, wPart] = weekYear.split('-W');
  const week = parseInt(wPart, 10);
  const jan4 = new Date(parseInt(year, 10), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() || 7) - 1));
  const result = new Date(startOfWeek1);
  result.setDate(startOfWeek1.getDate() + (week - 1 + delta) * 7);
  return isoWeekYear(result);
}

const VALID_CATEGORIES: TaskCategory[] = [
  'shopping',
  'chores',
  'finance',
  'goal',
  'cooking',
  'health',
  'kids',
  'transport',
];

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    private readonly anthropic: AnthropicService,
    private readonly familyEvents: FamilyEventsNotifier,
  ) {}

  private async classifyCategory(title: string, description?: string | null): Promise<TaskCategory> {
    try {
      const taskText = description ? `${title}\n${description}` : title;
      const msg = await this.anthropic.client.messages.create({
        model: this.anthropic.fastModel,
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: `Classify this household task into exactly one category. Reply with only the category keyword, nothing else.

Categories:
- shopping: mua sắm, siêu thị, order hàng, tạp hóa
- chores: dọn dẹp, giặt giũ, lau nhà, rửa bát, sắp xếp
- finance: chuyển tiền, đóng tiền, hóa đơn, ngân hàng, đầu tư
- goal: học tập, luyện tập, kế hoạch, phát triển bản thân
- cooking: nấu ăn, lên menu, đặt đồ ăn, bữa ăn, nguyên liệu
- health: khám bệnh, mua thuốc, tập gym, sức khỏe, bác sĩ
- kids: đón con, học bài cùng con, đồ dùng trẻ em, trường học
- transport: sửa xe, đổ xăng, bảo dưỡng xe, di chuyển

Task: "${taskText}"`,
          },
        ],
      });
      const text = (msg.content[0] as { type: string; text: string }).text
        .trim()
        .toLowerCase();
      const match = VALID_CATEGORIES.find((c) => text.includes(c));
      return match ?? 'chores';
    } catch {
      return 'chores';
    }
  }

  async list(user: User, week?: string): Promise<Task[]> {
    const weekYear = week ?? currentWeekYear();
    const thisWeek = currentWeekYear();

    if (weekYear === thisWeek) {
      const prevWeek = addWeeks(thisWeek, -1);
      const incomplete = await this.taskRepo.find({
        where: [
          { familyId: user.familyId!, weekYear: prevWeek, status: 'todo' as const },
          { familyId: user.familyId!, weekYear: prevWeek, status: 'in_progress' as const },
        ],
      });
      if (incomplete.length > 0) {
        await this.taskRepo.save(
          incomplete.map((t) => ({ ...t, weekYear: thisWeek })),
        );
      }
    }

    return this.taskRepo.find({
      where: { familyId: user.familyId!, weekYear },
      order: { createdAt: 'DESC' },
    });
  }

  async create(user: User, dto: CreateTaskDto): Promise<Task> {
    const category = dto.category ?? (await this.classifyCategory(dto.title, dto.description));
    const task = this.taskRepo.create({
      familyId: user.familyId!,
      createdBy: user.id,
      title: dto.title,
      category,
      assignee: dto.assignee,
      note: dto.note ?? null,
      description: dto.description ?? null,
      weekYear: dto.weekYear ?? currentWeekYear(),
      status: 'todo',
    });
    const saved = await this.taskRepo.save(task);
    void this.familyEvents.onTaskCreated(saved, user);
    return saved;
  }

  async update(user: User, id: string, dto: UpdateTaskDto): Promise<Task> {
    const task = await this.taskRepo.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.familyId !== user.familyId) throw new ForbiddenException();
    const before = { ...task };
    const patch: Partial<Task> = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined),
    );
    const newTitle = dto.title ?? task.title;
    const newDesc = dto.description !== undefined ? dto.description : task.description;
    const titleChanged = dto.title && dto.title !== task.title;
    const descChanged = dto.description !== undefined && dto.description !== task.description;
    if ((titleChanged || descChanged) && !dto.category) {
      patch.category = await this.classifyCategory(newTitle, newDesc);
    }
    Object.assign(task, patch);
    const saved = await this.taskRepo.save(task);
    const changes = diffTask(before, saved);
    if (changes.length > 0) {
      void this.familyEvents.onTaskUpdated(saved, user, changes);
    }
    return saved;
  }

  async remove(user: User, id: string): Promise<void> {
    const task = await this.taskRepo.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.familyId !== user.familyId) throw new ForbiddenException();
    const snapshot = { ...task };
    await this.taskRepo.remove(task);
    void this.familyEvents.onTaskDeleted(snapshot as Task, user);
  }
}

const TASK_CATEGORY_LABEL: Record<string, string> = {
  shopping: 'Mua sắm', chores: 'Việc nhà', finance: 'Tài chính', goal: 'Mục tiêu',
  cooking: 'Nấu ăn', health: 'Sức khoẻ', kids: 'Con cái', transport: 'Đi lại',
};
const TASK_STATUS_LABEL: Record<string, string> = {
  todo: 'Chưa làm', in_progress: 'Đang làm', done: 'Đã xong',
};
const TASK_ASSIGNEE_LABEL: Record<string, string> = {
  husband: 'Chồng', wife: 'Vợ', both: 'Cả hai',
};

function diffTask(
  before: Task,
  after: Task,
): Array<{ field: string; from: string; to: string }> {
  const changes: Array<{ field: string; from: string; to: string }> = [];
  if (before.title !== after.title) {
    changes.push({ field: 'Tiêu đề', from: before.title, to: after.title });
  }
  if (before.category !== after.category) {
    changes.push({
      field: 'Danh mục',
      from: TASK_CATEGORY_LABEL[before.category] ?? before.category,
      to: TASK_CATEGORY_LABEL[after.category] ?? after.category,
    });
  }
  if (before.assignee !== after.assignee) {
    changes.push({
      field: 'Phụ trách',
      from: TASK_ASSIGNEE_LABEL[before.assignee] ?? before.assignee,
      to: TASK_ASSIGNEE_LABEL[after.assignee] ?? after.assignee,
    });
  }
  if (before.status !== after.status) {
    changes.push({
      field: 'Trạng thái',
      from: TASK_STATUS_LABEL[before.status] ?? before.status,
      to: TASK_STATUS_LABEL[after.status] ?? after.status,
    });
  }
  if ((before.note ?? '') !== (after.note ?? '')) {
    changes.push({
      field: 'Ghi chú',
      from: before.note ?? '(trống)',
      to: after.note ?? '(trống)',
    });
  }
  if ((before.description ?? '') !== (after.description ?? '')) {
    changes.push({
      field: 'Mô tả',
      from: before.description ?? '(trống)',
      to: after.description ?? '(trống)',
    });
  }
  return changes;
}
