import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task } from './entities/task.entity';

function currentWeekYear(): string {
  const now = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }),
  );
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000);
  const week = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`;
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
      weekYear: currentWeekYear(),
      status: 'todo',
    });
    return this.taskRepo.save(task);
  }

  async update(user: User, id: string, dto: UpdateTaskDto): Promise<Task> {
    const task = await this.taskRepo.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.familyId !== user.familyId) throw new ForbiddenException();
    Object.assign(task, dto);
    return this.taskRepo.save(task);
  }

  async remove(user: User, id: string): Promise<void> {
    const task = await this.taskRepo.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.familyId !== user.familyId) throw new ForbiddenException();
    await this.taskRepo.remove(task);
  }
}
