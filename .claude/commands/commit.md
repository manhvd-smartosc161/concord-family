---
description: Group changes thành commit nhỏ theo scope, message conventional, không commit secrets
---

## Quy tắc kích hoạt (đọc trước khi làm bất cứ gì)

- **CHỈ commit khi user chủ động gọi `/commit`.** Không tự động commit giữa lúc làm task, không commit "tiện thể" sau khi sửa xong 1 file, không gợi ý commit khi user chưa hỏi.
- **Trong các turn không có `/commit`:** tuyệt đối KHÔNG chạy `git commit`, `git add`, hay bất kỳ thao tác nào tạo commit. Chỉ đọc git state (`git status`, `git diff`) là được phép khi cần để hiểu context.
- **Code phải xong trước khi commit.** Khi user gọi `/commit`, ngầm hiểu là toàn bộ thay đổi đang dở đã hoàn tất theo ý user. Nếu thấy dấu hiệu code chưa xong (TODO mới thêm, file rỗng, test fail rõ ràng, import chưa dùng do refactor dở), STOP và hỏi user trước khi commit — đừng đoán.
- Nếu giữa task user nói "ok đoạn này ổn" hay khen kết quả → KHÔNG suy diễn thành "commit luôn đi". Đợi `/commit` rõ ràng.

## Khi user gọi `/commit`, làm các bước sau:

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

   **NGÔN NGỮ COMMIT: TIẾNG ANH BẮT BUỘC.** Subject + body đều English. Quoted strings từ codebase/UI (vd `"đi chợ"`, `"Quỹ Mạnh"`) được giữ nguyên tiếng Việt vì đó là content thực, KHÔNG phải commentary. Mọi giải thích/lý do phải English.

5. Stage từng group bằng `git add <file>` (KHÔNG dùng `git add -A` hay `git add .`), commit từng cái một, mỗi commit dùng HEREDOC để format đẹp.

6. KHÔNG push (trừ khi tôi yêu cầu rõ).

7. Sau cùng, chạy `git status` để confirm clean.

Co-author footer: KHÔNG thêm Claude footer vào commit của project này (giữ author/footer như existing commits trong repo).
