import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import type { TaskAssignee, TaskCategory, TaskStatus } from '../entities/task.entity';

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsEnum(['shopping', 'chores', 'finance', 'goal', 'cooking', 'health', 'kids', 'transport'])
  category?: TaskCategory;

  @IsOptional()
  @IsEnum(['husband', 'wife', 'both'])
  assignee?: TaskAssignee;

  @IsOptional()
  @IsEnum(['todo', 'in_progress', 'done'])
  status?: TaskStatus;

  @IsOptional()
  @IsString()
  note?: string | null;
}
