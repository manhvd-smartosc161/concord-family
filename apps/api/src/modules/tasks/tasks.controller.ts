import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../shared/auth/decorators/current-user.decorator';
import { FamilyRequiredGuard } from '../../shared/auth/guards/family-required.guard';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { User } from '../users/entities/user.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task } from './entities/task.entity';
import { TasksService } from './tasks.service';

@UseGuards(JwtAuthGuard, FamilyRequiredGuard)
@Controller('api/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  list(@CurrentUser() user: User, @Query('week') week?: string): Promise<Task[]> {
    return this.tasksService.list(user, week);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateTaskDto): Promise<Task> {
    return this.tasksService.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<Task> {
    return this.tasksService.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: User, @Param('id') id: string): Promise<void> {
    return this.tasksService.remove(user, id);
  }
}
