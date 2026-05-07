---
description: Generate TypeORM migration từ entity changes hiện tại, review trước khi apply
argument-hint: <migration-name> (vd "AddBudgetEntity")
---

Tôi muốn generate một migration tên `$ARGUMENTS` cho api.

Quy trình:

1. Confirm với tôi: entity nào vừa thay đổi? (chạy `git status apps/api/src/**/entities/` để check, đừng đoán)
2. Chạy:
   ```
   pnpm --filter api migration:generate src/migrations/$ARGUMENTS
   ```
3. Mở file migration vừa generate trong `apps/api/src/migrations/`. Kiểm tra:
   - Có `DROP COLUMN` hay `DROP TABLE` không? Nếu có và cột/bảng đó đang có data → cảnh báo tôi, đề xuất viết tay phần preserve data.
   - Có `ALTER COLUMN ... NOT NULL` mà không có default → cảnh báo (sẽ fail nếu bảng có row).
   - SQL có làm gì bất ngờ ngoài entity diff không? (typeorm đôi khi reorder column gây diff thừa).
4. Hỏi tôi: "OK chạy migration:run chưa?" Chỉ chạy `pnpm --filter api migration:run` khi tôi xác nhận.
5. KHÔNG bao giờ:
   - Bật `synchronize: true`
   - Tự edit entity rồi commit mà chưa generate migration
   - Tự chạy `migration:run` mà không hỏi

Lưu ý: data-source là `apps/api/src/data-source.ts`, dùng env từ `.env`. Nếu lỗi connection → check Postgres đang chạy: `docker compose ps`.
