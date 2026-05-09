import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../shared/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../shared/auth/guards/jwt-auth.guard';
import { AuthService } from '../../shared/auth/auth.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { FamiliesService } from './families.service';
import { CreateFamilyDto } from './dto/create-family.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { UpdateFamilyDto } from './dto/update-family.dto';

@Controller('api/families')
export class FamiliesController {
  constructor(
    private readonly families: FamiliesService,
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@CurrentUser() user: User, @Body() dto: CreateFamilyDto) {
    await this.families.createForUser(user, dto);
    const fresh = await this.users.findById(user.id);
    if (!fresh) throw new Error('User vanished after createForUser');
    return this.auth.issueTokenForUser(fresh);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getCurrent(@CurrentUser() user: User) {
    return this.families.getCurrent(user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateFamily(@CurrentUser() user: User, @Body() dto: UpdateFamilyDto) {
    return this.families.updateFamily(user, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/invitations')
  createInvitation(
    @CurrentUser() user: User,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.families.createInvitation(user, dto);
  }

  @Get('invitations/:token')
  getInvitation(@Param('token') token: string) {
    return this.families.getInvitationByToken(token);
  }

  @UseGuards(JwtAuthGuard)
  @Post('invitations/:token/accept')
  async acceptInvitation(
    @CurrentUser() user: User,
    @Param('token') token: string,
  ) {
    await this.families.acceptInvitation(user, token);
    const fresh = await this.users.findById(user.id);
    if (!fresh) throw new Error('User vanished after acceptInvitation');
    return this.auth.issueTokenForUser(fresh);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me/leave')
  async leave(@CurrentUser() user: User) {
    await this.families.leaveFamily(user);
    const fresh = await this.users.findById(user.id);
    if (!fresh) throw new Error('User vanished after leaveFamily');
    return this.auth.issueTokenForUser(fresh);
  }
}
