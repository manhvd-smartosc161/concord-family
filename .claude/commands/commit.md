---
description: Group changes thành commit nhỏ theo scope, message conventional, không commit secrets
---

Tôi muốn commit thay đổi hiện tại. Làm các bước sau:

1. Chạy song song:
   - `git status`
   - `git diff` (unstaged + staged)
   - `git log -10 --oneline` (xem style commit message của repo)

2. Đọc diff và group changes thành **các commit nhỏ theo scope**, không gộp tất cả vào 1 commit. Group hợp lý:
   - 1 commit / module API mới (ví dụ "feat(api): add budgets module")
   - 1 commit / page UI mới (ví dụ "feat(web): add budgets page")
   - 1 commit cho migration (ví dụ "chore(db): migration AddBudgetEntity")
   - 1 commit cho docs/CLAUDE.md
   - 1 commit cho config (.env.example, package.json bump)
   - Refactor cross-cutting → commit riêng, KHÔNG nhét vào commit feature

3. CẢNH BÁO nếu thấy:
   - File `.env` (không phải `.env.example`) trong staged → STOP, hỏi tôi
   - File chứa pattern `sk-ant-`, `JWT_SECRET=`, password thật → STOP, hỏi tôi
   - File >1MB hoặc binary lạ → STOP, hỏi tôi
   - File `node_modules/`, `dist/`, `.next/` → STOP (gitignore lỗi)

4. Format message theo conventional commits đang dùng trong repo (xem `git log`):
   ```
   <type>(<scope>): <subject ngắn, dưới 70 ký tự>

   <optional body — chỉ khi giải thích "why" non-obvious>
   ```
   Type: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `style`.
   Scope: `api`, `web`, `db`, `agent`, `auth`, `infra`.

5. Stage từng group bằng `git add <file>` (KHÔNG dùng `git add -A` hay `git add .`), commit từng cái một, mỗi commit dùng HEREDOC để format đẹp.

6. KHÔNG push (trừ khi tôi yêu cầu rõ).

7. Sau cùng, chạy `git status` để confirm clean.

Co-author footer: KHÔNG thêm Claude footer vào commit của project này (giữ author/footer như existing commits trong repo).
