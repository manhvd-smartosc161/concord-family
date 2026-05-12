import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import type { TaskAssignee, TaskCategory } from '../entities/task.entity';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsEnum(['shopping', 'chores', 'finance', 'goal', 'cooking', 'health', 'kids', 'transport'])
  category?: TaskCategory;

  @IsEnum(['husband', 'wife', 'both'])
  assignee!: TaskAssignee;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-W\d{2}$/)
  weekYear?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
