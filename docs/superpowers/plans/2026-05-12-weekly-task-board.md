# Weekly Task Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng Kanban board hàng tuần cho cặp đôi track công việc (shopping, việc nhà, tài chính, mục tiêu) với swim lanes theo assignee.

**Architecture:** NestJS module `tasks` cung cấp 4 REST endpoints (GET/POST/PATCH/DELETE) với privacy enforce qua `familyId`. Frontend NextJS tại `/weekly` render Kanban board 3 columns × 3 swim lanes, dùng feature slice `features/tasks/`.

**Tech Stack:** NestJS 11 + TypeORM 0.3 (API), NextJS 16 App Router + Tailwind v4 (Web), PostgreSQL (DB via migration).

---

## File Map

**API — tạo mới:**

- `apps/api/src/modules/tasks/entities/task.entity.ts` — Task entity
- `apps/api/src/modules/tasks/dto/create-task.dto.ts` — DTO tạo task
- `apps/api/src/modules/tasks/dto/update-task.dto.ts` — DTO cập nhật task
- `apps/api/src/modules/tasks/tasks.service.ts` — business logic
- `apps/api/src/modules/tasks/tasks.controller.ts` — REST endpoints
- `apps/api/src/modules/tasks/tasks.module.ts` — module registration
- `apps/api/migrations/<timestamp>-CreateTasksTable.ts` — migration

**API — sửa:**

- `apps/api/src/app.module.ts` — thêm TasksModule vào imports
- `apps/api/src/data-source.ts` — thêm Task vào entities array

**Web — tạo mới:**

- `apps/web/features/tasks/types.ts` — Task, enums
- `apps/web/features/tasks/api.ts` — CRUD functions
- `apps/web/features/tasks/components/task-card.tsx` — card + inline expand
- `apps/web/features/tasks/components/task-quick-add.tsx` — form thêm nhanh
- `apps/web/features/tasks/components/task-board.tsx` — Kanban layout chính
- `apps/web/app/(authed)/weekly/page.tsx` — route page

**Web — sửa:**

- `apps/web/components/layout/sidebar.tsx` — thêm nav item Weekly

---

## Task 1: Task Entity + Migration

**Files:**

- Create: `apps/api/src/modules/tasks/entities/task.entity.ts`
- Create: `apps/api/migrations/<timestamp>-CreateTasksTable.ts`
- Modify: `apps/api/src/data-source.ts`

- [ ] **Step 1: Tạo Task entity**

```typescript
// apps/api/src/modules/tasks/entities/task.entity.ts
import { Column, Entity, Index } from "typeorm";
import { BaseEntity } from "../../../shared/common/base.entity";

export type TaskCategory = "shopping" | "chores" | "finance" | "goal";
export type TaskAssignee = "husband" | "wife" | "both";
export type TaskStatus = "todo" | "in_progress" | "done";

@Entity("tasks")
export class Task extends BaseEntity {
  @Index()
  @Column({ type: "uuid", name: "family_id" })
  familyId!: string;

  @Column({ type: "uuid", name: "created_by" })
  createdBy!: string;

  @Column({ type: "varchar", length: 200 })
  title!: string;

  @Column({ type: "enum", enum: ["shopping", "chores", "finance", "goal"] })
  category!: TaskCategory;

  @Column({ type: "enum", enum: ["husband", "wife", "both"] })
  assignee!: TaskAssignee;

  @Column({
    type: "enum",
    enum: ["todo", "in_progress", "done"],
    default: "todo",
  })
  status!: TaskStatus;

  @Index()
  @Column({ type: "varchar", length: 10, name: "week_year" })
  weekYear!: string;

  @Column({ type: "text", nullable: true })
  note!: string | null;
}
```

- [ ] **Step 2: Thêm Task vào data-source.ts**

Mở `apps/api/src/data-source.ts`. Thêm import:

```typescript
import { Task } from "./modules/tasks/entities/task.entity";
```

Thêm `Task` vào array `entities`.

- [ ] **Step 3: Generate migration**

```bash
cd apps/api
pnpm migration:generate migrations/CreateTasksTable
```

Kiểm tra file migration vừa tạo có `CREATE TABLE tasks` với đủ columns không. Nếu lệnh trên không tạo được, tạo migration thủ công:

```typescript
// apps/api/migrations/1779400000000-CreateTasksTable.ts
import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTasksTable1779400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE task_category_enum AS ENUM ('shopping', 'chores', 'finance', 'goal');
      CREATE TYPE task_assignee_enum AS ENUM ('husband', 'wife', 'both');
      CREATE TYPE task_status_enum AS ENUM ('todo', 'in_progress', 'done');

      CREATE TABLE tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        family_id UUID NOT NULL,
        created_by UUID NOT NULL,
        title VARCHAR(200) NOT NULL,
        category task_category_enum NOT NULL,
        assignee task_assignee_enum NOT NULL,
        status task_status_enum NOT NULL DEFAULT 'todo',
        week_year VARCHAR(10) NOT NULL,
        note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE INDEX idx_tasks_family_id ON tasks (family_id);
      CREATE INDEX idx_tasks_week_year ON tasks (week_year);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE tasks;
      DROP TYPE task_status_enum;
      DROP TYPE task_assignee_enum;
      DROP TYPE task_category_enum;
    `);
  }
}
```

- [ ] **Step 4: Chạy migration**

```bash
cd apps/api
pnpm migration:run
```

Expected output: `Migration CreateTasksTable... has been executed successfully.`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/tasks/entities/task.entity.ts apps/api/src/data-source.ts apps/api/migrations/
git commit -m "feat(api): add Task entity and migration"
```

---

## Task 2: DTOs

**Files:**

- Create: `apps/api/src/modules/tasks/dto/create-task.dto.ts`
- Create: `apps/api/src/modules/tasks/dto/update-task.dto.ts`

- [ ] **Step 1: Tạo CreateTaskDto**

```typescript
// apps/api/src/modules/tasks/dto/create-task.dto.ts
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import type { TaskAssignee, TaskCategory } from "../entities/task.entity";

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsEnum(["shopping", "chores", "finance", "goal"])
  category!: TaskCategory;

  @IsEnum(["husband", "wife", "both"])
  assignee!: TaskAssignee;

  @IsOptional()
  @IsString()
  note?: string;
}
```

- [ ] **Step 2: Tạo UpdateTaskDto**

```typescript
// apps/api/src/modules/tasks/dto/update-task.dto.ts
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import type {
  TaskAssignee,
  TaskCategory,
  TaskStatus,
} from "../entities/task.entity";

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsEnum(["shopping", "chores", "finance", "goal"])
  category?: TaskCategory;

  @IsOptional()
  @IsEnum(["husband", "wife", "both"])
  assignee?: TaskAssignee;

  @IsOptional()
  @IsEnum(["todo", "in_progress", "done"])
  status?: TaskStatus;

  @IsOptional()
  @IsString()
  note?: string | null;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/tasks/dto/
git commit -m "feat(api): add task DTOs"
```

---

## Task 3: TasksService

**Files:**

- Create: `apps/api/src/modules/tasks/tasks.service.ts`

- [ ] **Step 1: Tạo TasksService**

```typescript
// apps/api/src/modules/tasks/tasks.service.ts
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "../users/entities/user.entity";
import { CreateTaskDto } from "./dto/create-task.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { Task } from "./entities/task.entity";

function currentWeekYear(): string {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" })
  );
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor(
    (now.getTime() - startOfYear.getTime()) / 86400000
  );
  const week = Math.ceil((dayOfYear + startOfYear.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>
  ) {}

  list(user: User, week?: string): Promise<Task[]> {
    const weekYear = week ?? currentWeekYear();
    return this.taskRepo.find({
      where: { familyId: user.familyId!, weekYear },
      order: { createdAt: "ASC" },
    });
  }

  create(user: User, dto: CreateTaskDto): Promise<Task> {
    const task = this.taskRepo.create({
      familyId: user.familyId!,
      createdBy: user.id,
      title: dto.title,
      category: dto.category,
      assignee: dto.assignee,
      note: dto.note ?? null,
      weekYear: currentWeekYear(),
      status: "todo",
    });
    return this.taskRepo.save(task);
  }

  async update(user: User, id: string, dto: UpdateTaskDto): Promise<Task> {
    const task = await this.taskRepo.findOne({ where: { id } });
    if (!task) throw new NotFoundException("Task not found");
    if (task.familyId !== user.familyId) throw new ForbiddenException();
    Object.assign(task, dto);
    return this.taskRepo.save(task);
  }

  async remove(user: User, id: string): Promise<void> {
    const task = await this.taskRepo.findOne({ where: { id } });
    if (!task) throw new NotFoundException("Task not found");
    if (task.familyId !== user.familyId) throw new ForbiddenException();
    await this.taskRepo.remove(task);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/tasks/tasks.service.ts
git commit -m "feat(api): add TasksService with family-scoped CRUD"
```

---

## Task 4: TasksController + Module Registration

**Files:**

- Create: `apps/api/src/modules/tasks/tasks.controller.ts`
- Create: `apps/api/src/modules/tasks/tasks.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Tạo TasksController**

```typescript
// apps/api/src/modules/tasks/tasks.controller.ts
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
} from "@nestjs/common";
import { CurrentUser } from "../../shared/auth/decorators/current-user.decorator";
import { FamilyRequiredGuard } from "../../shared/auth/guards/family-required.guard";
import { JwtAuthGuard } from "../../shared/auth/guards/jwt-auth.guard";
import { User } from "../users/entities/user.entity";
import { CreateTaskDto } from "./dto/create-task.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { Task } from "./entities/task.entity";
import { TasksService } from "./tasks.service";

@UseGuards(JwtAuthGuard, FamilyRequiredGuard)
@Controller("api/tasks")
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  list(
    @CurrentUser() user: User,
    @Query("week") week?: string
  ): Promise<Task[]> {
    return this.tasksService.list(user, week);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateTaskDto): Promise<Task> {
    return this.tasksService.create(user, dto);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: User,
    @Param("id") id: string,
    @Body() dto: UpdateTaskDto
  ): Promise<Task> {
    return this.tasksService.update(user, id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@CurrentUser() user: User, @Param("id") id: string): Promise<void> {
    return this.tasksService.remove(user, id);
  }
}
```

- [ ] **Step 2: Tạo TasksModule**

```typescript
// apps/api/src/modules/tasks/tasks.module.ts
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Task } from "./entities/task.entity";
import { TasksController } from "./tasks.controller";
import { TasksService } from "./tasks.service";

@Module({
  imports: [TypeOrmModule.forFeature([Task])],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
```

- [ ] **Step 3: Đăng ký TasksModule trong app.module.ts**

Mở `apps/api/src/app.module.ts`. Thêm import:

```typescript
import { TasksModule } from "./modules/tasks/tasks.module";
```

Thêm `TasksModule` vào array `imports` (sau `ImportantDatesModule`).

- [ ] **Step 4: Khởi động API và test thủ công**

```bash
pnpm --filter api dev
```

Test:

```bash
# Lấy JWT token trước (login)
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"yourpassword"}'

# Tạo task
curl -X POST http://localhost:3001/api/tasks \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Mua rau","category":"shopping","assignee":"wife"}'

# List tasks
curl http://localhost:3001/api/tasks \
  -H "Authorization: Bearer <token>"
```

Expected: task vừa tạo xuất hiện trong list với `weekYear` đúng.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/tasks/
git add apps/api/src/app.module.ts
git commit -m "feat(api): add tasks module with REST endpoints"
```

---

## Task 5: Frontend Types + API Client

**Files:**

- Create: `apps/web/features/tasks/types.ts`
- Create: `apps/web/features/tasks/api.ts`

- [ ] **Step 1: Tạo types.ts**

```typescript
// apps/web/features/tasks/types.ts
export type TaskCategory = "shopping" | "chores" | "finance" | "goal";
export type TaskAssignee = "husband" | "wife" | "both";
export type TaskStatus = "todo" | "in_progress" | "done";

export interface Task {
  id: string;
  familyId: string;
  createdBy: string;
  title: string;
  category: TaskCategory;
  assignee: TaskAssignee;
  status: TaskStatus;
  weekYear: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  category: TaskCategory;
  assignee: TaskAssignee;
  note?: string;
}

export interface UpdateTaskInput {
  title?: string;
  category?: TaskCategory;
  assignee?: TaskAssignee;
  status?: TaskStatus;
  note?: string | null;
}
```

- [ ] **Step 2: Tạo api.ts**

```typescript
// apps/web/features/tasks/api.ts
import { apiFetch } from "@/lib/api-client";
import type { CreateTaskInput, Task, UpdateTaskInput } from "./types";

export function listTasks(week?: string): Promise<Task[]> {
  const query = week ? `?week=${week}` : "";
  return apiFetch<Task[]>(`/api/tasks${query}`);
}

export function createTask(input: CreateTaskInput): Promise<Task> {
  return apiFetch<Task>("/api/tasks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
  return apiFetch<Task>(`/api/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteTask(id: string): Promise<void> {
  return apiFetch<void>(`/api/tasks/${id}`, { method: "DELETE" });
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/features/tasks/types.ts apps/web/features/tasks/api.ts
git commit -m "feat(web): add tasks feature types and API client"
```

---

## Task 6: TaskCard Component

**Files:**

- Create: `apps/web/features/tasks/components/task-card.tsx`

- [ ] **Step 1: Tạo task-card.tsx**

```typescript
// apps/web/features/tasks/components/task-card.tsx
"use client";

import { useState } from "react";
import type { Task, TaskStatus, UpdateTaskInput } from "../types";

const CATEGORY_CONFIG = {
  shopping: { label: "Mua sắm", color: "bg-blue-100 text-blue-700" },
  chores: { label: "Việc nhà", color: "bg-orange-100 text-orange-700" },
  finance: { label: "Tài chính", color: "bg-green-100 text-green-700" },
  goal: { label: "Mục tiêu", color: "bg-purple-100 text-purple-700" },
} as const;

const NEXT_STATUS: Record<TaskStatus, TaskStatus | null> = {
  todo: "in_progress",
  in_progress: "done",
  done: null,
};

const NEXT_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "▶ Bắt đầu",
  in_progress: "✓ Xong",
  done: "",
};

interface Props {
  task: Task;
  onUpdate: (id: string, input: UpdateTaskInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function TaskCard({ task, onUpdate, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editNote, setEditNote] = useState(task.note ?? "");
  const [saving, setSaving] = useState(false);

  const cat = CATEGORY_CONFIG[task.category];
  const nextStatus = NEXT_STATUS[task.status];

  async function handleStatusAdvance() {
    if (!nextStatus) return;
    setSaving(true);
    await onUpdate(task.id, { status: nextStatus });
    setSaving(false);
  }

  async function handleNoteSave() {
    setSaving(true);
    await onUpdate(task.id, { note: editNote || null });
    setSaving(false);
    setExpanded(false);
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          className="flex-1 text-left"
          onClick={() => setExpanded((v) => !v)}
        >
          <p
            className={`text-sm font-medium text-stone-800 ${
              task.status === "done" ? "line-through opacity-50" : ""
            }`}
          >
            {task.title}
          </p>
        </button>
        <button
          type="button"
          onClick={() => onDelete(task.id)}
          className="shrink-0 text-xs text-stone-300 hover:text-red-400"
          aria-label="Xóa"
        >
          ✕
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cat.color}`}
        >
          {cat.label}
        </span>
        {nextStatus && (
          <button
            type="button"
            disabled={saving}
            onClick={handleStatusAdvance}
            className="ml-auto rounded px-2 py-0.5 text-[10px] font-medium text-stone-500 hover:bg-stone-100 disabled:opacity-50"
          >
            {NEXT_STATUS_LABEL[task.status]}
          </button>
        )}
      </div>

      {expanded && (
        <div className="mt-2 border-t border-stone-100 pt-2">
          <textarea
            className="w-full rounded border border-stone-200 p-2 text-xs text-stone-700 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            rows={2}
            placeholder="Ghi chú..."
            value={editNote}
            onChange={(e) => setEditNote(e.target.value)}
          />
          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                setEditNote(task.note ?? "");
              }}
              className="text-xs text-stone-400 hover:text-stone-600"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleNoteSave}
              className="rounded bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Lưu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/features/tasks/components/task-card.tsx
git commit -m "feat(web): add TaskCard component"
```

---

## Task 7: TaskQuickAdd Component

**Files:**

- Create: `apps/web/features/tasks/components/task-quick-add.tsx`

- [ ] **Step 1: Tạo task-quick-add.tsx**

```typescript
// apps/web/features/tasks/components/task-quick-add.tsx
"use client";

import { useState } from "react";
import type { CreateTaskInput, TaskAssignee, TaskCategory } from "../types";

interface Props {
  onAdd: (input: CreateTaskInput) => Promise<void>;
}

const CATEGORIES: { value: TaskCategory; label: string }[] = [
  { value: "shopping", label: "🛒 Mua sắm" },
  { value: "chores", label: "🏠 Việc nhà" },
  { value: "finance", label: "💰 Tài chính" },
  { value: "goal", label: "🎯 Mục tiêu" },
];

const ASSIGNEES: { value: TaskAssignee; label: string }[] = [
  { value: "both", label: "👫 Cả hai" },
  { value: "husband", label: "👨 Chồng" },
  { value: "wife", label: "👩 Vợ" },
];

export function TaskQuickAdd({ onAdd }: Props) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<TaskCategory>("shopping");
  const [assignee, setAssignee] = useState<TaskAssignee>("both");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    await onAdd({ title: title.trim(), category, assignee });
    setTitle("");
    setLoading(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-stone-300 bg-stone-50 p-3"
    >
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Thêm task..."
        className="min-w-0 flex-1 rounded border border-stone-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"
        disabled={loading}
      />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as TaskCategory)}
        className="rounded border border-stone-200 bg-white px-2 py-1.5 text-sm focus:outline-none"
        disabled={loading}
      >
        {CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <select
        value={assignee}
        onChange={(e) => setAssignee(e.target.value as TaskAssignee)}
        className="rounded border border-stone-200 bg-white px-2 py-1.5 text-sm focus:outline-none"
        disabled={loading}
      >
        {ASSIGNEES.map((a) => (
          <option key={a.value} value={a.value}>
            {a.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={loading || !title.trim()}
        className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
      >
        + Thêm
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/features/tasks/components/task-quick-add.tsx
git commit -m "feat(web): add TaskQuickAdd component"
```

---

## Task 8: TaskBoard Component

**Files:**

- Create: `apps/web/features/tasks/components/task-board.tsx`

- [ ] **Step 1: Tạo task-board.tsx**

```typescript
// apps/web/features/tasks/components/task-board.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { createTask, deleteTask, listTasks, updateTask } from "../api";
import type {
  CreateTaskInput,
  Task,
  TaskAssignee,
  TaskStatus,
  UpdateTaskInput,
} from "../types";
import { TaskCard } from "./task-card";
import { TaskQuickAdd } from "./task-quick-add";

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "todo", label: "Todo" },
  { status: "in_progress", label: "In Progress" },
  { status: "done", label: "Done" },
];

const SWIM_LANES: { assignee: TaskAssignee; label: string }[] = [
  { assignee: "both", label: "👫 Cả hai" },
  { assignee: "husband", label: "👨 Chồng" },
  { assignee: "wife", label: "👩 Vợ" },
];

function getISOWeek(date: Date): string {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function parseWeek(weekYear: string): Date {
  const [year, wPart] = weekYear.split("-W");
  const week = parseInt(wPart, 10);
  const jan4 = new Date(parseInt(year, 10), 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() || 7) - 1));
  const result = new Date(startOfWeek1);
  result.setDate(startOfWeek1.getDate() + (week - 1) * 7);
  return result;
}

function addWeeks(weekYear: string, delta: number): string {
  const d = parseWeek(weekYear);
  d.setDate(d.getDate() + delta * 7);
  return getISOWeek(d);
}

export function TaskBoard() {
  const [currentWeek, setCurrentWeek] = useState(() => getISOWeek(new Date()));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async (week: string) => {
    setLoading(true);
    try {
      const data = await listTasks(week);
      setTasks(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload(currentWeek);
  }, [currentWeek, reload]);

  async function handleAdd(input: CreateTaskInput) {
    const task = await createTask(input);
    setTasks((prev) => [...prev, task]);
  }

  async function handleUpdate(id: string, input: UpdateTaskInput) {
    const updated = await updateTask(id, input);
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }

  async function handleDelete(id: string) {
    await deleteTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-stone-800">Weekly Board</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentWeek((w) => addWeeks(w, -1))}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
          >
            ←
          </button>
          <span className="min-w-[90px] text-center text-sm font-medium text-stone-700">
            {currentWeek}
          </span>
          <button
            type="button"
            onClick={() => setCurrentWeek((w) => addWeeks(w, 1))}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm hover:bg-stone-50"
          >
            →
          </button>
        </div>
      </div>

      <TaskQuickAdd onAdd={handleAdd} />

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-stone-400">
          Đang tải...
        </div>
      ) : (
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse">
            <thead>
              <tr>
                <th className="w-28 border border-stone-200 bg-stone-50 p-2 text-left text-xs font-semibold text-stone-500" />
                {COLUMNS.map((col) => (
                  <th
                    key={col.status}
                    className="border border-stone-200 bg-stone-50 p-2 text-center text-xs font-semibold uppercase tracking-wide text-stone-500"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SWIM_LANES.map((lane) => (
                <tr key={lane.assignee}>
                  <td className="border border-stone-200 bg-stone-50 p-3 text-sm font-medium text-stone-600 align-top">
                    {lane.label}
                  </td>
                  {COLUMNS.map((col) => {
                    const cells = tasks.filter(
                      (t) =>
                        t.assignee === lane.assignee && t.status === col.status
                    );
                    return (
                      <td
                        key={col.status}
                        className="min-h-[80px] border border-stone-200 p-2 align-top"
                      >
                        <div className="flex flex-col gap-2">
                          {cells.map((task) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              onUpdate={handleUpdate}
                              onDelete={handleDelete}
                            />
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/features/tasks/components/task-board.tsx
git commit -m "feat(web): add TaskBoard Kanban component"
```

---

## Task 9: Page + Sidebar Nav

**Files:**

- Create: `apps/web/app/(authed)/weekly/page.tsx`
- Modify: `apps/web/components/layout/sidebar.tsx`

- [ ] **Step 1: Tạo weekly page**

```typescript
// apps/web/app/(authed)/weekly/page.tsx
import { TaskBoard } from "@/features/tasks/components/task-board";

export default function WeeklyPage() {
  return <TaskBoard />;
}
```

- [ ] **Step 2: Thêm nav item vào sidebar**

Mở `apps/web/components/layout/sidebar.tsx`. Thêm vào array `NAV` (sau `{ href: '/goals', ... }`):

```typescript
{ href: '/weekly', label: 'Tuần này', icon: '📋' },
```

- [ ] **Step 3: Kiểm tra UI trên trình duyệt**

Khởi động dev server nếu chưa chạy:

```bash
pnpm dev
```

Vào `http://localhost:3000/weekly`. Kiểm tra:

- Sidebar hiển thị "📋 Công việc"
- Board render đúng 3 columns × 3 swim lanes
- Quick-add form hoạt động: tạo task → xuất hiện đúng cell
- Nút ▶ / ✓ chuyển task sang cột tiếp theo
- Click card → expand ghi chú, lưu được
- Nút ✕ xóa task
- Nút ← → chuyển tuần

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(authed\)/weekly/page.tsx apps/web/components/layout/sidebar.tsx
git commit -m "feat(web): add /weekly page and sidebar nav item"
```
