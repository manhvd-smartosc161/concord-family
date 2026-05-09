import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { User } from '../../../modules/users/entities/user.entity';

@Injectable()
export class FamilyRequiredGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{ user: User }>();
    if (!req.user?.familyId) {
      throw new ForbiddenException('Bạn chưa thuộc gia đình nào.');
    }
    return true;
  }
}
