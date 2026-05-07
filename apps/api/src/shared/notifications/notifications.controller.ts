import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../../modules/users/entities/user.entity';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard)
@Controller('api/notifications/device-tokens')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Post()
  async register(
    @CurrentUser() user: User,
    @Body() dto: RegisterDeviceTokenDto,
  ): Promise<{ id: string }> {
    const t = await this.service.registerToken(
      user.id,
      dto.token,
      dto.platform,
    );
    return { id: t.id };
  }

  @Delete(':token')
  @HttpCode(204)
  async unregister(
    @CurrentUser() user: User,
    @Param('token') token: string,
  ): Promise<void> {
    await this.service.unregisterToken(user.id, token);
  }
}
