# Deploy Concord lên Vercel + Supabase + Koyeb (full free)

Combo này không cần VM, không cần domain mua, không cần card verify rườm rà
như Oracle. Tổng cost: **0 đồng** (Anthropic API tính riêng).

- **Vercel**: host NextJS web (free hobby)
- **Supabase**: Postgres + pgvector (free 500MB, auto-pause sau 1 tuần inactive)
- **Koyeb**: host NestJS api (free 1 service 512MB RAM, không sleep)

## 0. Yêu cầu

- Account GitHub (3 platform đều deploy từ GitHub)
- Repo Concord đã push lên GitHub (private OK)
- Anthropic API key

## 1. Push code lên GitHub (~5 phút)

Nếu chưa có:
```bash
cd /Users/manhvd/Desktop/claude-training/concord
gh repo create concord --private --source=. --push
# hoặc tạo repo trên web rồi:
# git remote add origin git@github.com:<you>/concord.git
# git push -u origin main
```

## 2. Setup Supabase (~10 phút)

1. Vào [supabase.com](https://supabase.com), Sign in với GitHub
2. **New project**:
   - Name: `concord`
   - Database password: random mạnh — **lưu lại ngay**, sẽ dùng nhiều
   - Region: **Singapore (Southeast Asia)** cho latency tốt
   - Plan: Free
3. Đợi ~2 phút Supabase provision DB
4. Khi xong, vào project → **Database → Extensions** → search `vector` → toggle ON (enable pgvector)
5. **Settings → Database → Connection string** → tab **URI** → copy chuỗi:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxxx.supabase.co:5432/postgres
   ```
   Thay `[YOUR-PASSWORD]` bằng password ở step 2. Thêm `?sslmode=require` cuối:
   ```
   postgresql://postgres:abc123@db.xxx.supabase.co:5432/postgres?sslmode=require
   ```

**Note**: Supabase có 2 connection mode — **Direct** (port 5432) và **Pooler**
(port 6543, transaction pooler). Concord dùng TypeORM với connection pool sẵn
trong Node, dùng **Direct** (5432) là OK. Pooler chỉ cần khi serverless dạng
Cloud Run/Lambda.

## 3. Run migrations từ máy local (1 lần)

Migrations cần chạy 1 lần đầu trước khi api deploy.

```bash
cd apps/api
DATABASE_URL='postgresql://postgres:abc123@db.xxx.supabase.co:5432/postgres?sslmode=require' \
POSTGRES_SSL=true \
pnpm migration:run
```

Output: `Migration <name> has been executed successfully` x N. Nếu fail → check
connection string + password.

Sau đó seed user vợ chồng:
```bash
DATABASE_URL='...' POSTGRES_SSL=true pnpm seed
```

## 4. Setup Koyeb cho NestJS API (~15 phút)

1. Vào [koyeb.com](https://www.koyeb.com), Sign in với GitHub. Verify số điện thoại.
2. **Create Service** → **GitHub**
3. Authorize Koyeb access repo `concord`
4. Form **Deploy from GitHub**:
   - Repository: `<you>/concord`
   - Branch: `main`
   - **Builder**: chọn **Dockerfile**
   - Dockerfile location: `apps/api/Dockerfile`
   - Build context: `.` (root repo)
5. **Service type**: **Web Service**
6. **Instance**: Free (eco), Region: **Frankfurt** hoặc **Washington** (Koyeb free
   chỉ có 2 region này — latency cho VN ~150-200ms, chấp nhận được cho 2 user)
7. **Ports**: 3001, expose port (mặc định Koyeb đoán đúng nếu Dockerfile có `EXPOSE 3001`)
8. **Environment variables** — paste từng cái:

   ```
   NODE_ENV=production
   API_PORT=3001
   DATABASE_URL=postgresql://postgres:abc123@db.xxx.supabase.co:5432/postgres?sslmode=require
   POSTGRES_SSL=true
   ANTHROPIC_API_KEY=sk-ant-...
   ANTHROPIC_DEFAULT_MODEL=claude-sonnet-4-6
   ANTHROPIC_FAST_MODEL=claude-haiku-4-5-20251001
   JWT_SECRET=<openssl rand -hex 32>
   JWT_EXPIRES_IN=7d
   NEXTAUTH_URL=https://concord-manh.vercel.app
   ```

   `NEXTAUTH_URL` để tạm placeholder, anh quay lại update sau khi có URL Vercel.

9. **Service name**: `concord-api`
10. **Deploy** — Koyeb pull repo, build Docker image (~5-8 phút), start container.

Khi xong, Koyeb cấp public URL kiểu:
```
https://concord-api-<your-org>.koyeb.app
```

Test:
```bash
curl https://concord-api-xxx.koyeb.app/api/auth/me
# Expect 401 Unauthorized — nghĩa là API đang chạy
```

## 5. Setup Vercel cho NextJS Web (~10 phút)

1. Vào [vercel.com](https://vercel.com), Sign in với GitHub
2. **Add New → Project** → import repo `concord`
3. Form configure:
   - **Framework Preset**: Next.js (auto-detect)
   - **Root Directory**: `apps/web`
   - Bấm **Edit** → chọn `apps/web`
   - Build settings: để default Vercel detect monorepo pnpm
   - **Install Command**: `pnpm install --frozen-lockfile`
   - **Build Command**: `pnpm --filter web build` (hoặc để Vercel auto)
   - **Output Directory**: `.next` (default)
4. **Environment Variables**:
   ```
   NEXT_PUBLIC_API_URL=https://concord-api-xxx.koyeb.app
   ```
   (URL Koyeb từ step 4)

5. **Deploy** — Vercel build (~3-5 phút).

Vercel cấp URL:
```
https://concord-<your-username>.vercel.app
```

## 6. Quay lại Koyeb update CORS (~2 phút)

API hiện đang block request từ Vercel domain. Vào Koyeb service `concord-api`
→ **Settings → Environment Variables** → update:

```
NEXTAUTH_URL=https://concord-<your-username>.vercel.app
```

(Hoặc thêm biến mới `CORS_ORIGIN` cùng giá trị, code hỗ trợ cả 2.)

Bấm **Save & Redeploy**. Koyeb restart container ~30 giây.

## 7. Test end-to-end

1. Mở `https://concord-<your-username>.vercel.app`
2. Login với user đã seed
3. Vào tab Chat, gõ "đi ăn 200k"
4. Check transaction xuất hiện ở Dashboard

Nếu lỗi → check logs:
- **Vercel**: project → Deployments → latest → **Functions logs** / **Build logs**
- **Koyeb**: service → **Runtime logs**
- **Supabase**: project → **Logs → Postgres**

## 8. Backup Supabase

Free tier Supabase có **daily backup tự động** (giữ 7 ngày). Vào project →
**Database → Backups** để xem / restore.

Nếu muốn backup tay xuống local:
```bash
pg_dump 'postgresql://postgres:abc123@db.xxx.supabase.co:5432/postgres?sslmode=require' \
  --no-owner --no-privileges \
  | gzip > backup-$(date -u +%F).sql.gz
```

## 9. Update khi push code mới

Push lên GitHub → cả Vercel + Koyeb auto-deploy.

```bash
git push origin main
```

- Vercel: rebuild + deploy ~2-3 phút
- Koyeb: rebuild Docker + deploy ~5-8 phút

Migration mới: chạy local pointing tới Supabase **trước khi** push code:
```bash
DATABASE_URL='...' POSTGRES_SSL=true pnpm --filter api migration:run
git push
```

Quy tắc: **migration luôn chạy local trước, không cho Koyeb auto-run** — vì
nếu migration fail giữa chừng + container Koyeb restart liên tục, dễ corrupt
schema. Local chạy có thể inspect lỗi và rollback.

## Pitfalls thường gặp

**Supabase auto-pause sau 1 tuần inactive**
- Login Supabase dashboard tay → wake DB
- Hoặc setup cron Vercel/GitHub Actions ping `/api/auth/me` mỗi 5 ngày để keep alive

**Koyeb cold-build chậm**
- Free tier build trên shared runner, build NestJS ~5-8 phút lần đầu
- Lần sau Koyeb cache layers nhanh hơn (~2-3 phút)

**500MB Supabase đầy**
- Concord DB cho 2 user / 1 năm transactions chỉ vài MB. Còn lâu mới full.
- Nếu approach 80%: dọn `chat_messages` cũ, hoặc upgrade Supabase Pro $25/tháng

**512MB RAM Koyeb không đủ**
- NestJS startup ~150-200MB, runtime ~250-300MB cho 2 user → vừa đủ
- Nếu OOM: upgrade Koyeb $5.5/tháng cho 1GB

**CORS lỗi sau redeploy**
- Đảm bảo `NEXTAUTH_URL` ở Koyeb match chính xác URL Vercel (https, không trailing slash)

## Resources được dùng

- Vercel: hobby plan, unlimited bandwidth cho hobby project
- Supabase: 500MB DB, 2GB egress, 50K monthly active users
- Koyeb: 1 service 512MB / 0.1 vCPU, 100GB egress
- Tất cả **0 đồng vĩnh viễn** (theo policy 2026)

## So sánh với Oracle Cloud

| | Vercel + Supabase + Koyeb | Oracle Cloud Always Free |
|---|---|---|
| Setup time | ~45 phút | ~2 giờ |
| Card verify | Không cần | Cần (hay reject) |
| Maintenance | Auto, scale-to-zero | Tự lo OS update |
| DB latency | ~50-100ms (DB qua internet) | ~1ms (local socket) |
| Cold start | Vercel: 0, Koyeb: ~3s sau idle | Không (luôn warm) |
| Resource | 512MB RAM api | 12GB RAM toàn stack |
| Cost-future | Free vĩnh viễn | Free vĩnh viễn |
