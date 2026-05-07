import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../shared/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { User } from '../users/entities/user.entity';
import { CreateImportantDateDto } from './dto/create-important-date.dto';
import { UpdateImportantDateDto } from './dto/update-important-date.dto';
import { ImportantDatesCron } from './important-dates.cron';
import {
  ImportantDatesService,
  ImportantDateView,
} from './important-dates.service';

@UseGuards(JwtAuthGuard)
@Controller('api/important-dates')
export class ImportantDatesController {
  constructor(
    private readonly service: ImportantDatesService,
    private readonly cron: ImportantDatesCron,
  ) {}

  @Get()
  list(): Promise<ImportantDateView[]> {
    return this.service.list();
  }

  @Post()
  create(
    @CurrentUser() user: User,
    @Body() dto: CreateImportantDateDto,
  ): Promise<ImportantDateView> {
    return this.service.create(user.id, dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ImportantDateView> {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateImportantDateDto,
  ): Promise<ImportantDateView> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.remove(id);
  }

  @Post('_test-tick')
  async testTick(): Promise<{ count: number }> {
    if (process.env.NODE_ENV !== 'development') {
      throw new ForbiddenException('test tick disabled outside development');
    }
    return this.cron.run();
  }
}
