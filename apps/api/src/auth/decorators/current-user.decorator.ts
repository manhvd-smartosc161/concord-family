import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '../../users/entities/user.entity';

/**
 * Inject the authenticated user into a controller method:
 *
 *   @UseGuards(JwtAuthGuard)
 *   @Get()
 *   list(@CurrentUser() user: User) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User => {
    const req = ctx.switchToHttp().getRequest<Request & { user: User }>();
    return req.user;
  },
);
