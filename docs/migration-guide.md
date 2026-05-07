# DB Migration Guide — Production

## Cơ chế tracking

TypeORM tự tracking qua bảng `migrations` trong DB. Idempotent: chỉ chạy migration nào chưa có trong bảng đó.

Migration file `.ts` được compile thành `.js` khi build — production chạy từ `dist/`.
Class name phải unique và khớp với timestamp prefix để TypeORM nhận diện đúng thứ tự.

```bash
pnpm --filter api migration:run     # apply tất cả pending
pnpm --filter api migration:show    # xem trạng thái từng migration
pnpm --filter api migration:revert  # rollback migration mới nhất (dùng down())
```

---

## Danh sách migrations

| Timestamp | File | Mô tả |
|-----------|------|-------|
| `1778042018828` | `InitSchema` | Schema ban đầu: users, funds, transactions, categories, goals, salary_rules, anomalies, budgets, insights |
| `1778062016316` | `AddChatHistory` | Thêm bảng `chat_sessions` + `chat_messages` |
| `1778064512470` | `AddChatFundScope` | Refactor `chat_sessions`: bỏ `user_id`, thêm `fund_id` + `created_by_id` |
| `1778090863334` | `AddEnvelopeFields` | Thêm cột `purpose`, `target_amount`, `target_deadline`, `monthly_contribution_target`, `display_order`, `archived_at` vào `funds` |
| `1778145299000` | `FundPurposeRename` | Rename enum: `general`→`spending`, `envelope`→`savings`, thêm `investment` |

---

## Chi tiết các migration cần chú ý

### `AddEnvelopeFields` — 1778090863334

**Bảng:** `funds`

Thêm các cột phục vụ quỹ tiết kiệm/đầu tư:

```sql
ALTER TABLE funds ADD purpose funds_purpose_enum NOT NULL DEFAULT 'general';
ALTER TABLE funds ADD target_amount bigint;
ALTER TABLE funds ADD target_deadline date;
ALTER TABLE funds ADD monthly_contribution_target bigint;
ALTER TABLE funds ADD display_order integer NOT NULL DEFAULT 0;
ALTER TABLE funds ADD archived_at timestamptz;
```

**Rủi ro:** Thấp. Các cột nullable hoặc có DEFAULT — không ảnh hưởng row hiện có.

---

### `FundPurposeRename` — 1778145299000

**Bảng:** `funds` — column `purpose` (PostgreSQL enum type)

Rename enum values theo business logic mới:

| Giá trị cũ | Giá trị mới | Ý nghĩa |
|-----------|------------|---------|
| `general` | `spending` | 3 quỹ chi tiêu gốc (Mạnh/Vợ/Chung) — không archive được |
| `envelope` | `savings` | Quỹ tiết kiệm có mục tiêu (du lịch, khẩn cấp, …) |
| *(mới)* | `investment` | Quỹ đầu tư dài hạn (chứng khoán, BĐS, …) |

Migration thực hiện qua `CREATE TYPE ... AS ENUM` mới + `ALTER COLUMN ... USING CASE WHEN ...` — rename in-place, không mất data.

**Rủi ro:** Trung bình. PostgreSQL lock bảng `funds` ngắn trong quá trình `ALTER TYPE`. Với bảng nhỏ (< 20 rows) lock dưới 1 giây, không ảnh hưởng thực tế.

**Rollback:** `down()` đã implement — `spending`→`general`, `savings`→`envelope`, `investment`→`envelope`.

---

## Checklist chạy production

```bash
# 1. Backup DB trước (bắt buộc)
pg_dump -Fc concord_db > concord_$(date +%Y%m%d_%H%M).dump

# 2. Kiểm tra migration nào chưa chạy
pnpm --filter api migration:show

# 3. Chạy migrations
pnpm --filter api migration:run

# 4. Verify
psql concord_db -c "SELECT name FROM migrations ORDER BY timestamp;"
psql concord_db -c "SELECT name, purpose FROM funds;"
# Kỳ vọng: 3 rows spending (Mạnh/Vợ/Chung) + các envelope nếu đã tạo
```

---

## Lưu ý

- Không cần seed lại. Data hiện có không bị xóa — enum rename tự migrate qua `USING CASE`.
- Không dùng `synchronize: true` trong production — mọi schema change phải qua migration file.
- Khi thêm entity/column mới trong dev: `/db-migrate <Name>` để generate migration, review SQL trước khi commit.
