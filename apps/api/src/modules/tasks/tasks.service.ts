import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task } from './entities/task.entity';

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

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
  ) {}

  list(user: User, week?: string): Promise<Task[]> {
    const weekYear = week ?? currentWeekYear();
    return this.taskRepo.find({
      where: { familyId: user.familyId!, weekYear },
      order: { createdAt: 'ASC' },
    });
  }

  create(user: User, dto: CreateTaskDto): Promise<Task> {
    const task = this.taskRepo.create({
      familyId: user.familyId!,
      createdBy: user.id,
      title: dto.title,
      category: dto.category,
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
    const patch = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined),
    );
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
