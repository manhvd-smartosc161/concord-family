---
description: Generate TypeORM migration vào apps/api/migrations/ từ entity changes, review trước khi apply
argument-hint: <migration-name> (vd "AddBudgetEntity")
---

Tôi muốn generate migration tên `$ARGUMENTS` cho api.

Quy trình:

1. Confirm với tôi: entity nào vừa thay đổi? (chạy `git status apps/api/src/modules/**/entities/` để check, đừng đoán)
2. Chạy:
   ```
   pnpm --filter api migration:generate migrations/$ARGUMENTS
   ```
3. Mở file migration vừa generate trong `apps/api/migrations/`. Kiểm tra:
   - Có `DROP COLUMN` hay `DROP TABLE` không? Nếu có và cột/bảng đó đang có data → cảnh báo tôi.
   - Có `ALTER COLUMN ... NOT NULL` mà không có default → cảnh báo (sẽ fail nếu bảng có row).
   - SQL có làm gì bất ngờ ngoài entity diff không?
4. Hỏi tôi: "OK chạy migration:run chưa?" Chỉ chạy `pnpm --filter api migration:run` khi tôi xác nhận.
5. KHÔNG bao giờ:
   - Bật `synchronize: true`
   - Tự edit entity rồi commit mà chưa generate migration
   - Tự chạy `migration:run` mà không hỏi

Lưu ý: `data-source.ts` ở `apps/api/src/`, nhưng migrations ở `apps/api/migrations/` (ngoài src/). Nếu lỗi connection → check Postgres đang chạy: `docker compose ps`.
