# Weekly Task Board — Design Spec

**Date:** 2026-05-12
**Status:** Approved

## Overview

Tính năng Weekly Task Board cho phép cặp đôi track công việc hàng tuần (shopping, việc nhà, tài chính, mục tiêu) trên một Kanban board với swim lanes theo assignee. Độc lập hoàn toàn với dữ liệu tài chính.

## Data Model

### Entity: `Task`

| Field | Type | Constraint |
|---|---|---|
| `id` | uuid | PK |
| `title` | varchar | not null |
| `category` | enum | `shopping` / `chores` / `finance` / `goal` |
| `assignee` | enum | `husband` / `wife` / `both` |
| `status` | enum | `todo` / `in_progress` / `done` |
| `weekYear` | varchar | ISO week key, vd `"2026-W20"`, not null |
| `familyId` | uuid | FK → Family, not null |
| `createdBy` | uuid | FK → User, not null |
| `note` | text | nullable |
| `createdAt` / `updatedAt` | timestamp | BaseEntity |

**Weekly reset:** Không xóa data cũ — mỗi tuần có `weekYear` riêng. Board cũ tự nhiên archive, vẫn queryable.

## API

Module NestJS: `src/modules/tasks/`

### Endpoints

| Method | Path | Mô tả |
|---|---|---|
| `GET` | `/api/tasks?week=2026-W20` | Tasks của tuần, thuộc family hiện tại |
| `POST` | `/api/tasks` | Tạo task mới |
| `PATCH` | `/api/tasks/:id` | Cập nhật task (bất kỳ field) |
| `DELETE` | `/api/tasks/:id` | Xóa task |

**Default week:** Nếu không truyền `?week=`, trả tuần hiện tại (timezone `Asia/Ho_Chi_Minh`).

### Auth & Privacy
- Tất cả endpoints dùng `@UseGuards(JwtAuthGuard)`.
- Service enforce `familyId` — chỉ member cùng family mới thấy/sửa tasks.
- Mọi member đều có thể edit/delete task của nhau (không cần ownership check).

## Frontend

### Route
`/weekly` → `app/(authed)/weekly/page.tsx`

### Feature Slice
```
features/tasks/
├── api.ts              getTasks, createTask, updateTask, deleteTask
├── types.ts            Task, TaskCategory, TaskAssignee, TaskStatus
└── components/
    ├── task-board.tsx      layout chính (swim lanes × columns)
    ├── task-card.tsx       card + inline expand note
    └── task-quick-add.tsx  form thêm nhanh inline
```

### Board Layout

Columns = status (Todo / In Progress / Done)
Swim lanes = assignee (Cả hai / Chồng / Vợ)

```
┌─────────────────────────────────────────────────┐
│  Weekly Board  [← Tuần trước] [2026-W20] [→]   │
│  [+ Thêm task]                                  │
├──────────────┬──────────────┬───────────────────┤
│   TODO       │  IN PROGRESS │      DONE         │
├──────────────┼──────────────┼───────────────────┤
│ 👫 Cả hai   │              │                   │
├──────────────┼──────────────┼───────────────────┤
│ 👨 Chồng    │              │                   │
├──────────────┼──────────────┼───────────────────┤
│ 👩 Vợ       │              │                   │
└──────────────┴──────────────┴───────────────────┘
```

### Task Card
- Title + category badge (màu riêng: Shopping/Chores/Finance/Goal)
- Click → inline expand để xem/sửa note
- Nút chuyển status sang cột tiếp theo
- Nút xóa

### Quick-Add Form
Inline (không modal): gõ title → chọn category + assignee → Enter để tạo. Default status = `todo`.

## Out of Scope
- Sub-tasks
- Due date per task
- Drag-and-drop Kanban
- Tích hợp transactions
- Notification / reminder
