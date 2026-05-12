import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import type { TaskAssignee, TaskCategory } from '../entities/task.entity';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsEnum(['shopping', 'chores', 'finance', 'goal'])
  category!: TaskCategory;

  @IsEnum(['husband', 'wife', 'both'])
  assignee!: TaskAssignee;

  @IsOptional()
  @IsString()
  note?: string;
}
