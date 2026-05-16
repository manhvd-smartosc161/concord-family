import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Fund } from '../../modules/funds/entities/fund.entity';
import { User } from '../../modules/users/entities/user.entity';
import { EmailService } from './email.service';
import { FamilyEventsNotifier } from './family-events.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Fund])],
  providers: [EmailService, FamilyEventsNotifier],
  exports: [FamilyEventsNotifier],
})
export class FamilyEventsModule {}
