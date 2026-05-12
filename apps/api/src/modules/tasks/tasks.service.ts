import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnthropicService } from '../../agent/core/anthropic.service';
import { User } from '../users/entities/user.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task, TaskCategory } from './entities/task.entity';

function isoWeekYear(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function currentWeekYear(): string {
  return isoWeekYear(new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' })));
}

const VALID_CATEGORIES: TaskCategory[] = ['shopping', 'chores', 'finance', 'goal', 'cooking', 'health', 'kids', 'transport'];

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    private readonly anthropic: AnthropicService,
  ) {}

  private async classifyCategory(title: string): Promise<TaskCategory> {
    try {
      const msg = await this.anthropic.client.messages.create({
        model: this.anthropic.fastModel,
        max_tokens: 10,
        messages: [{
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

Task: "${title}"`,
        }],
      });
      const text = (msg.content[0] as { type: string; text: string }).text.trim().toLowerCase();
      const match = VALID_CATEGORIES.find((c) => text.includes(c));
      return match ?? 'chores';
    } catch {
      return 'chores';
    }
  }

  list(user: User, week?: string): Promise<Task[]> {
    const weekYear = week ?? currentWeekYear();
    return this.taskRepo.find({
      where: { familyId: user.familyId!, weekYear },
      order: { createdAt: 'ASC' },
    });
  }

  async create(user: User, dto: CreateTaskDto): Promise<Task> {
    const category = dto.category ?? await this.classifyCategory(dto.title);
    const task = this.taskRepo.create({
      familyId: user.familyId!,
      createdBy: user.id,
      title: dto.title,
      category,
      assignee: dto.assignee,
      note: dto.note ?? null,
      weekYear: dto.weekYear ?? currentWeekYear(),
      status: 'todo',
    });
    return this.taskRepo.save(task);
  }

  async update(user: User, id: string, dto: UpdateTaskDto): Promise<Task> {
    const task = await this.taskRepo.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.familyId !== user.familyId) throw new ForbiddenException();
    const patch: Partial<Task> = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined),
    );
    if (dto.title && dto.title !== task.title && !dto.category) {
      patch.category = await this.classifyCategory(dto.title);
    }
    Object.assign(task, patch);
    return this.taskRepo.save(task);
  }

  async remove(user: User, id: string): Promise<void> {
    const task = await this.taskRepo.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.familyId !== user.familyId) throw new ForbiddenException();
    await this.taskRepo.remove(task);
  }
}
