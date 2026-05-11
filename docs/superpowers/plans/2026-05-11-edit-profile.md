# Edit Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users edit their display name, birthdate, and upload a profile photo from the Settings page.

**Architecture:** New `AvatarService` in `apps/api/src/shared/avatar/` handles Supabase Storage upload/delete using `sharp` for resizing. A new `POST /api/auth/me/avatar` endpoint returns the updated `AuthUserDto`. On the frontend, `AccountSection` gains an inline edit mode; a shared `UserAvatar` component renders in both the header and settings card.

**Tech Stack:** NestJS `FileInterceptor` (Multer, already bundled), `sharp`, `@supabase/supabase-js`, React inline form, Tailwind v4.

---

## File Map

### Backend — create
- `apps/api/src/shared/avatar/avatar.service.ts` — Supabase Storage upload + delete
- `apps/api/src/shared/avatar/avatar.module.ts` — NestJS module wrapping AvatarService
- `apps/api/migrations/1779300000000-AddAvatarUrlToUsers.ts` — migration

### Backend — modify
- `apps/api/package.json` — add `sharp`, `@supabase/supabase-js`, `@types/sharp`, `@types/multer`
- `apps/api/src/modules/users/entities/user.entity.ts` — add `avatarUrl` column
- `apps/api/src/shared/auth/auth.types.ts` — add `avatarUrl` to `AuthUserDto`
- `apps/api/src/shared/auth/auth.service.ts` — add `avatarUrl` to `toAuthUser()`
- `apps/api/src/shared/auth/auth.controller.ts` — add `POST me/avatar` endpoint
- `apps/api/src/shared/auth/auth.module.ts` — import `AvatarModule`
- `.env.example` — add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

### Frontend — create
- `apps/web/features/auth/components/user-avatar.tsx` — shared avatar circle component

### Frontend — modify
- `apps/web/features/auth/types.ts` — add `avatarUrl` to `AuthUser`
- `apps/web/features/auth/api.ts` — add `uploadAvatar()`
- `apps/web/features/auth/hooks.ts` — add `reloadUser` to `useAuth` return value
- `apps/web/app/(authed)/layout.tsx` — add `reloadUser` to `LayoutCtx`
- `apps/web/components/layout/header.tsx` — use `UserAvatar` instead of initials div
- `apps/web/app/(authed)/settings/page.tsx` — rework `AccountSection` with view/edit modes

---

## Task 1: Install API dependencies

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: Install packages**

```bash
pnpm --filter api add sharp @supabase/supabase-js
pnpm --filter api add -D @types/multer
```

Expected: no errors, `sharp` and `@supabase/supabase-js` appear in `apps/api/package.json` dependencies.

- [ ] **Step 2: Verify build still passes**

```bash
pnpm --filter api build
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml
git commit -m "chore(api): add sharp and supabase-js for avatar upload"
```

---

## Task 2: DB migration — add avatar_url column

**Files:**
- Modify: `apps/api/src/modules/users/entities/user.entity.ts`
- Create: `apps/api/migrations/1779300000000-AddAvatarUrlToUsers.ts`

- [ ] **Step 1: Add column to User entity**

In `apps/api/src/modules/users/entities/user.entity.ts`, add after the `birthdate` column:

```ts
@Column({ type: 'varchar', length: 500, name: 'avatar_url', nullable: true })
avatarUrl!: string | null;
```

- [ ] **Step 2: Generate migration**

```bash
pnpm --filter api migration:generate migrations/AddAvatarUrlToUsers
```

Expected: creates `apps/api/migrations/<timestamp>-AddAvatarUrlToUsers.ts`.

- [ ] **Step 3: Rename migration file to fixed timestamp**

Rename the generated file to `1779300000000-AddAvatarUrlToUsers.ts` and update the class name inside to `AddAvatarUrlToUsers1779300000000`. This keeps timestamps predictable.

- [ ] **Step 4: Verify migration SQL**

Open the file and confirm it contains:
```sql
ALTER TABLE "users" ADD "avatar_url" character varying(500)
```
No DROP columns. No surprises.

- [ ] **Step 5: Run migration locally**

```bash
pnpm --filter api migration:run
```

Expected: `[migrations] applied 1 migration(s)` — no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/users/entities/user.entity.ts \
        apps/api/migrations/1779300000000-AddAvatarUrlToUsers.ts
git commit -m "chore(db): migration AddAvatarUrlToUsers"
```

---

## Task 3: Propagate avatarUrl through AuthUserDto → toAuthUser

**Files:**
- Modify: `apps/api/src/shared/auth/auth.types.ts`
- Modify: `apps/api/src/shared/auth/auth.service.ts`

- [ ] **Step 1: Add avatarUrl to AuthUserDto**

In `apps/api/src/shared/auth/auth.types.ts`, update `AuthUserDto`:

```ts
export interface AuthUserDto {
  id: string;
  name: string;
  email: string;
  role: UserRole | null;
  gender: 'male' | 'female';
  familyId: string | null;
  birthdate: string | null;
  avatarUrl: string | null;
}
```

- [ ] **Step 2: Update toAuthUser in auth.service.ts**

In `apps/api/src/shared/auth/auth.service.ts`, update `toAuthUser`:

```ts
toAuthUser(user: User): AuthUserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    gender: user.gender,
    familyId: user.familyId,
    birthdate: user.birthdate,
    avatarUrl: user.avatarUrl,
  };
}
```

- [ ] **Step 3: Verify build**

```bash
pnpm --filter api build
```

Expected: exits 0 with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/shared/auth/auth.types.ts \
        apps/api/src/shared/auth/auth.service.ts
git commit -m "feat(api): add avatarUrl to AuthUserDto"
```

---

## Task 4: AvatarService — Supabase Storage upload/delete

**Files:**
- Create: `apps/api/src/shared/avatar/avatar.service.ts`
- Create: `apps/api/src/shared/avatar/avatar.module.ts`

- [ ] **Step 1: Create AvatarService**

Create `apps/api/src/shared/avatar/avatar.service.ts`:

```ts
import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as sharp from 'sharp';

@Injectable()
export class AvatarService {
  private readonly supabase: SupabaseClient;
  private readonly bucket = 'avatars';
  private readonly logger = new Logger(AvatarService.name);

  constructor(private readonly config: ConfigService) {
    const url = config.getOrThrow<string>('SUPABASE_URL');
    const key = config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');
    this.supabase = createClient(url, key);
  }

  async upload(
    userId: string,
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const path = `${userId}/${Date.now()}.${ext}`;

    const resized = await sharp(fileBuffer)
      .resize(400, 400, { fit: 'cover', position: 'center' })
      .toBuffer();

    const { error } = await this.supabase.storage
      .from(this.bucket)
      .upload(path, resized, { contentType: mimeType, upsert: false });

    if (error) {
      this.logger.error(`Supabase upload failed: ${error.message}`);
      throw new BadGatewayException('Avatar upload failed');
    }

    const { data } = this.supabase.storage.from(this.bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async delete(avatarUrl: string): Promise<void> {
    try {
      const url = new URL(avatarUrl);
      const parts = url.pathname.split(`/object/public/${this.bucket}/`);
      if (parts.length < 2) return;
      const path = parts[1];
      const { error } = await this.supabase.storage.from(this.bucket).remove([path]);
      if (error) {
        this.logger.warn(`Failed to delete old avatar (${path}): ${error.message}`);
      }
    } catch {
      this.logger.warn(`Could not parse avatarUrl for deletion: ${avatarUrl}`);
    }
  }
}
```

- [ ] **Step 2: Create AvatarModule**

Create `apps/api/src/shared/avatar/avatar.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AvatarService } from './avatar.service';

@Module({
  imports: [ConfigModule],
  providers: [AvatarService],
  exports: [AvatarService],
})
export class AvatarModule {}
```

- [ ] **Step 3: Verify build**

```bash
pnpm --filter api build
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/shared/avatar/
git commit -m "feat(api): add AvatarService for Supabase Storage upload"
```

---

## Task 5: POST /api/auth/me/avatar endpoint

**Files:**
- Modify: `apps/api/src/shared/auth/auth.controller.ts`
- Modify: `apps/api/src/shared/auth/auth.module.ts`

- [ ] **Step 1: Import AvatarModule in AuthModule**

In `apps/api/src/shared/auth/auth.module.ts`, add `AvatarModule` to imports:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../../modules/users/users.module';
import { AvatarModule } from '../avatar/avatar.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule,
    AvatarModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'change-me',
        signOptions: {
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ??
            '7d') as unknown as number,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

- [ ] **Step 2: Add uploadAvatar endpoint to AuthController**

In `apps/api/src/shared/auth/auth.controller.ts`, add the following imports and method. Full updated file:

```ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { User } from '../../modules/users/entities/user.entity';
import { UsersService } from '../../modules/users/users.service';
import { AvatarService } from '../avatar/avatar.service';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthUserDto, LoginResponseDto } from './auth.types';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

@Controller('api/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly avatarService: AvatarService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto): Promise<LoginResponseDto> {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: User): AuthUserDto {
    return this.authService.toAuthUser(user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateProfileDto,
  ): Promise<AuthUserDto> {
    const updated = await this.usersService.updateProfile(user.id, dto);
    return this.authService.toAuthUser(updated);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<AuthUserDto> {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG, or WebP images are allowed');
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('File must be under 5MB');
    }

    const newUrl = await this.avatarService.upload(user.id, file.buffer, file.mimetype);

    if (user.avatarUrl) {
      await this.avatarService.delete(user.avatarUrl);
    }

    const updated = await this.usersService.updateProfile(user.id, { avatarUrl: newUrl });
    return this.authService.toAuthUser(updated);
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('change-password')
  async changePassword(
    @CurrentUser() user: User,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.authService.changePassword(user, dto);
  }
}
```

- [ ] **Step 3: Update UsersService.updateProfile to accept avatarUrl**

In `apps/api/src/modules/users/users.service.ts`, update the `updateProfile` signature:

```ts
async updateProfile(
  userId: string,
  dto: { name?: string; birthdate?: string | null; avatarUrl?: string | null },
): Promise<User> {
  const user = await this.repo.findOneByOrFail({ id: userId });
  if (dto.name !== undefined) user.name = dto.name;
  if (dto.birthdate !== undefined) {
    user.birthdate = dto.birthdate ? dto.birthdate.slice(0, 10) : null;
  }
  if (dto.avatarUrl !== undefined) user.avatarUrl = dto.avatarUrl;
  return this.repo.save(user);
}
```

- [ ] **Step 4: Verify build**

```bash
pnpm --filter api build
```

Expected: exits 0.

- [ ] **Step 5: Manual smoke test (needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env)**

```bash
# Start API
pnpm --filter api start:dev

# In another terminal — upload a test image
curl -s -X POST http://localhost:3001/api/auth/me/avatar \
  -H "Authorization: Bearer <your-token>" \
  -F "file=@/path/to/test.jpg" | jq .avatarUrl
```

Expected: a public Supabase Storage URL.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/shared/auth/auth.controller.ts \
        apps/api/src/shared/auth/auth.module.ts \
        apps/api/src/modules/users/users.service.ts
git commit -m "feat(api): add POST /api/auth/me/avatar endpoint"
```

---

## Task 6: Update .env.example

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add Supabase env vars**

In `.env.example`, add after the existing `POSTGRES_*` block:

```
# ─── Supabase (Storage for avatars) ──────────────────────────────────
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Settings → API → service_role key (keep secret)
```

- [ ] **Step 2: Add to Render environment**

In Render dashboard → service `concord-api` → Environment:
- `SUPABASE_URL` = `https://diucwefjchjdwefvdahk.supabase.co` (same project as DB)
- `SUPABASE_SERVICE_ROLE_KEY` = service_role key from Supabase → Settings → API

- [ ] **Step 3: Create Supabase Storage bucket**

In Supabase dashboard → Storage:
1. Click "New bucket"
2. Name: `avatars`
3. Toggle **Public bucket** ON
4. Save

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "chore(infra): document Supabase Storage env vars for avatar upload"
```

---

## Task 7: Frontend — types + API function

**Files:**
- Modify: `apps/web/features/auth/types.ts`
- Modify: `apps/web/features/auth/api.ts`

- [ ] **Step 1: Add avatarUrl to AuthUser**

In `apps/web/features/auth/types.ts`:

```ts
export type UserRole = 'husband' | 'wife';
export type UserGender = 'male' | 'female';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole | null;
  gender: UserGender;
  familyId: string | null;
  birthdate: string | null;
  avatarUrl: string | null;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  gender: UserGender;
  birthdate?: string;
}
```

- [ ] **Step 2: Add uploadAvatar to features/auth/api.ts**

In `apps/web/features/auth/api.ts`, add at the end:

```ts
export function uploadAvatar(file: File): Promise<AuthUser> {
  const form = new FormData();
  form.append('file', file);
  return apiFetch<AuthUser>('/api/auth/me/avatar', {
    method: 'POST',
    body: form,
  });
}
```

Note: do NOT set `Content-Type` header — browser sets it automatically with the correct boundary when using `FormData`. `apiFetch` must not force `application/json` for this call. Check `apps/web/lib/api-client.ts` — if it sets `Content-Type: application/json` unconditionally, add a guard: only set it when `body` is a string.

- [ ] **Step 3: Check api-client for Content-Type override**

Open `apps/web/lib/api-client.ts` and verify the headers logic. If it does something like:

```ts
headers: { 'Content-Type': 'application/json', ...init?.headers }
```

Change it to:

```ts
const headers: Record<string, string> = {};
if (typeof init?.body === 'string') {
  headers['Content-Type'] = 'application/json';
}
if (token) headers['Authorization'] = `Bearer ${token}`;
```

Merge with any caller-provided headers after.

- [ ] **Step 4: Verify TypeScript**

```bash
pnpm --filter web build
```

Expected: exits 0 with no type errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/features/auth/types.ts apps/web/features/auth/api.ts \
        apps/web/lib/api-client.ts
git commit -m "feat(web): add avatarUrl to AuthUser + uploadAvatar API function"
```

---

## Task 8: useAuth reloadUser + LayoutCtx

**Files:**
- Modify: `apps/web/features/auth/hooks.ts`
- Modify: `apps/web/app/(authed)/layout.tsx`

- [ ] **Step 1: Add reloadUser to useAuth**

Replace `apps/web/features/auth/hooks.ts` with:

```ts
'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, clearToken, getToken } from '@/lib/api-client';
import { me } from '@/features/auth/api';
import type { AuthUser } from '@/features/auth/types';

export type AuthState =
  | { status: 'loading' }
  | { status: 'authed'; user: AuthUser }
  | { status: 'unauthed' };

export function useAuth(redirectIfUnauthed = true): {
  state: AuthState;
  reloadUser: () => Promise<void>;
} {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const router = useRouter();

  const fetchUser = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setState({ status: 'unauthed' });
      if (redirectIfUnauthed) router.replace('/login');
      return;
    }
    try {
      const user = await me();
      setState({ status: 'authed', user });
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) clearToken();
      setState({ status: 'unauthed' });
      if (redirectIfUnauthed) router.replace('/login');
    }
  }, [redirectIfUnauthed, router]);

  useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  return { state, reloadUser: fetchUser };
}

export function logout(router: ReturnType<typeof useRouter>): void {
  clearToken();
  router.replace('/login');
}
```

- [ ] **Step 2: Update layout.tsx to use new useAuth return shape**

The layout currently calls `useAuth()` and accesses `auth.status`, `auth.user`. Update all usages to destructure `{ state: auth, reloadUser }` from `useAuth()`, and add `reloadUser` to `LayoutCtx`.

In `apps/web/app/(authed)/layout.tsx`:

```ts
interface LayoutCtx {
  user: AuthUser;
  funds: FundView[];
  reloadFunds: () => Promise<void>;
  reloadUser: () => Promise<void>;
}
```

Change:
```ts
const auth = useAuth();
```
To:
```ts
const { state: auth, reloadUser } = useAuth();
```

Then in both `<LayoutContext.Provider value={...}>` places add `reloadUser`:

```ts
<LayoutContext.Provider value={{ user: auth.user, funds, reloadFunds, reloadUser }}>
```

- [ ] **Step 3: Verify build**

```bash
pnpm --filter web build
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/features/auth/hooks.ts apps/web/app/\(authed\)/layout.tsx
git commit -m "feat(web): expose reloadUser in useAuth and LayoutCtx"
```

---

## Task 9: UserAvatar shared component

**Files:**
- Create: `apps/web/features/auth/components/user-avatar.tsx`

- [ ] **Step 1: Create UserAvatar component**

Create `apps/web/features/auth/components/user-avatar.tsx`:

```tsx
import Image from 'next/image';
import type { AuthUser } from '../types';

interface Props {
  user: Pick<AuthUser, 'name' | 'role' | 'avatarUrl'>;
  size?: number;
  editable?: boolean;
  onClick?: () => void;
}

export function UserAvatar({ user, size = 32, editable = false, onClick }: Props) {
  const initials = user.name.charAt(0).toUpperCase();
  const colorClass =
    user.role === 'husband'
      ? 'bg-emerald-100 text-emerald-800'
      : 'bg-amber-100 text-amber-800';

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full ${editable ? 'cursor-pointer' : ''}`}
      style={{ width: size, height: size }}
      onClick={onClick}
    >
      {user.avatarUrl ? (
        <Image
          src={user.avatarUrl}
          alt={user.name}
          fill
          className="object-cover"
          sizes={`${size}px`}
          unoptimized
        />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center text-sm font-semibold ${colorClass}`}
        >
          {initials}
        </div>
      )}

      {editable && (
        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity hover:opacity-100">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.92c.04-.3.07-.62.07-.93s-.03-.64-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.36-.07.7-.07 1s.03.65.07 1l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.58 1.69-.98l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66Z" />
          </svg>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/features/auth/components/user-avatar.tsx
git commit -m "feat(web): add UserAvatar shared component"
```

---

## Task 10: Update Header to use UserAvatar

**Files:**
- Modify: `apps/web/components/layout/header.tsx`

- [ ] **Step 1: Replace initials div with UserAvatar**

In `apps/web/components/layout/header.tsx`, add the import:

```ts
import { UserAvatar } from '@/features/auth/components/user-avatar';
```

Replace this block:

```tsx
<div
  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
    user.role === 'husband'
      ? 'bg-emerald-100 text-emerald-800'
      : 'bg-amber-100 text-amber-800'
  }`}
>
  {user.name.charAt(0).toUpperCase()}
</div>
```

With:

```tsx
<UserAvatar user={user} size={32} />
```

- [ ] **Step 2: Verify build**

```bash
pnpm --filter web build
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/layout/header.tsx
git commit -m "feat(web): use UserAvatar in header"
```

---

## Task 11: AccountSection — inline edit mode

**Files:**
- Modify: `apps/web/app/(authed)/settings/page.tsx`

- [ ] **Step 1: Replace AccountSection with view/edit modes**

Replace the entire `AccountSection` function and the `Field` helper in `apps/web/app/(authed)/settings/page.tsx`. Keep all other sections (`YearlyGoalSection`, `OpeningBalanceSection`, `DangerZoneSection`) untouched.

Add these imports at the top of the file (alongside existing ones):

```ts
import { updateProfile, uploadAvatar } from '@/features/auth/api';
import { UserAvatar } from '@/features/auth/components/user-avatar';
import { useAuthedLayout } from '../layout';
```

Replace `AccountSection` and `Field` with:

```tsx
function AccountSection() {
  const { user, reloadUser } = useAuthedLayout();
  const [pwOpen, setPwOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  const [name, setName] = useState(user.name);
  const [birthdate, setBirthdate] = useState(user.birthdate ?? '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const isDirty =
    name.trim() !== user.name ||
    (birthdate || null) !== (user.birthdate ?? null) ||
    avatarFile !== null;

  function handleEnterEdit() {
    setName(user.name);
    setBirthdate(user.birthdate ?? '');
    setAvatarFile(null);
    setAvatarPreview(null);
    setAvatarError(null);
    setError(null);
    setEditing(true);
  }

  function handleCancel() {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(null);
    setAvatarPreview(null);
    setAvatarError(null);
    setError(null);
    setEditing(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setAvatarError('Chỉ chấp nhận JPEG, PNG hoặc WebP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Ảnh phải nhỏ hơn 5MB');
      return;
    }
    setAvatarError(null);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    e.target.value = '';
  }

  async function handleSave() {
    if (!isDirty || saving) return;
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (avatarFile) {
        await uploadAvatar(avatarFile);
      }
      const nameChanged = name.trim() !== user.name;
      const bdChanged = (birthdate || null) !== (user.birthdate ?? null);
      if (nameChanged || bdChanged) {
        await updateProfile({
          name: name.trim(),
          birthdate: birthdate || null,
        });
      }
      await reloadUser();
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarFile(null);
      setAvatarPreview(null);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setSaving(false);
    }
  }

  const displayAvatar = avatarPreview
    ? { ...user, avatarUrl: avatarPreview }
    : user;

  return (
    <Card padding="p-6">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h3 className="mb-1 text-sm font-semibold text-stone-800">Tài khoản</h3>
          {!editing && (
            <p className="text-xs text-stone-500">
              Concord là couple-only — mỗi instance chỉ có 2 tài khoản (vợ + chồng).
            </p>
          )}
        </div>
        {!editing && (
          <button
            onClick={handleEnterEdit}
            className="shrink-0 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50"
          >
            Chỉnh sửa
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-2">
            <input
              id="avatar-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
            <label htmlFor="avatar-input" className="cursor-pointer">
              <UserAvatar user={displayAvatar} size={80} editable />
            </label>
            {avatarError && (
              <p className="text-xs text-rose-600">{avatarError}</p>
            )}
            <p className="text-[11px] text-stone-400">Bấm vào ảnh để thay đổi</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-stone-500">
                Tên
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm transition-colors focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-stone-500">
                Ngày sinh
              </label>
              <input
                type="date"
                value={birthdate}
                max={today}
                onChange={(e) => setBirthdate(e.target.value)}
                className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm transition-colors focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <Field label="Vai trò" value={user.role === 'husband' ? 'Chồng' : 'Vợ'} />
            <Field label="Email" value={user.email} mono />
          </div>

          {error && <p className="text-xs text-rose-600">⚠️ {error}</p>}

          <div className="flex justify-end gap-2 border-t border-stone-100 pt-4">
            <button
              onClick={handleCancel}
              disabled={saving}
              className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50"
            >
              Huỷ
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !isDirty || !name.trim()}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-800 active:scale-[0.99] disabled:bg-stone-300"
            >
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-5 flex items-center gap-4">
            <UserAvatar user={user} size={56} />
            <div>
              <div className="text-base font-semibold text-stone-900">{user.name}</div>
              <div className="text-xs text-stone-500">
                {user.role === 'husband' ? 'Chồng' : 'Vợ'} · {user.email}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Ngày sinh" value={user.birthdate ?? '—'} />
            <Field label="ID" value={user.id} mono small />
          </div>

          <div className="mt-5 flex justify-end border-t border-stone-100 pt-4">
            <button
              onClick={() => setPwOpen(true)}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-800 active:scale-[0.99]"
            >
              🔐 Đổi mật khẩu
            </button>
          </div>
        </>
      )}

      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </Card>
  );
}

function Field({
  label,
  value,
  mono,
  small,
}: {
  label: string;
  value: string;
  mono?: boolean;
  small?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
        {label}
      </div>
      <div
        className={`mt-1 ${mono ? 'font-mono' : ''} ${small ? 'text-xs' : 'text-sm'} text-stone-800`}
      >
        {value}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
pnpm --filter web build
```

Expected: exits 0 with no type errors.

- [ ] **Step 3: Start dev server and test manually**

```bash
pnpm dev
```

Test checklist:
1. Settings page loads → see avatar circle + name + role/email in view mode
2. Click "Chỉnh sửa" → form appears with current name + birthdate pre-filled
3. Upload a JPEG (under 5MB) → preview updates instantly, no page refresh
4. Try uploading a `.txt` file → inline error appears
5. Clear name field → Lưu button disabled
6. Click Huỷ → form disappears, original data restored
7. Change name + save → name updates in header avatar dropdown immediately

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(authed\)/settings/page.tsx
git commit -m "feat(web): add inline edit profile with avatar upload to Settings"
```
