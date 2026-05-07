import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Apply with `@UseGuards(JwtAuthGuard)` on a controller / route.
 * Pulls the Bearer token from `Authorization` header, validates via JwtStrategy,
 * and attaches the User entity to `req.user`.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
