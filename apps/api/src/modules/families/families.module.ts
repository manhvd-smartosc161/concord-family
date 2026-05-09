import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Family } from './entities/family.entity';
import { FamilyInvitation } from './entities/family-invitation.entity';
import { User } from '../users/entities/user.entity';
import { Fund } from '../funds/entities/fund.entity';
import { Category } from '../categories/entities/category.entity';
import { ImportantDate } from '../important-dates/entities/important-date.entity';
import { FamiliesService } from './families.service';
import { FamiliesController } from './families.controller';
import { AuthModule } from '../../shared/auth/auth.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../../shared/notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Family,
      FamilyInvitation,
      User,
      Fund,
      Category,
      ImportantDate,
    ]),
    AuthModule,
    UsersModule,
    NotificationsModule,
  ],
  providers: [FamiliesService],
  controllers: [FamiliesController],
  exports: [FamiliesService],
})
export class FamiliesModule {}
