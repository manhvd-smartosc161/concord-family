# Deployment Runbook — Concord

Stack production hiện tại: **Vercel (web) + Render (api) + Supabase (Postgres pgvector) + Anthropic (LLM)**. Cost ~$0/tháng (Anthropic API tính theo usage).

## 1. Kiến trúc

```
┌─ Vercel ─────────────┐    ┌─ Render ─────────────┐    ┌─ Supabase ───────┐
│ concord-family-web   │ -> │ concord-api-49oq     │ -> │ Postgres pgvector │
│ apps/web (Next.js)   │    │ apps/api (NestJS)    │    │ ap-south-1 pooler │
│ Auto-deploy main     │    │ Docker, free 512MB   │    │ Free 500MB        │
│ Build-arg URL → API  │    │ Sleeps 15min idle    │    │ Daily backup auto │
└──────────────────────┘    └──────────────────────┘    └───────────────────┘
                                       │
                                       └─> Anthropic API (Sonnet 4.6 + Haiku 4.5)
```

URLs hiện tại:
- **Web**: https://concord-family-web.vercel.app
- **API**: https://concord-api-49oq.onrender.com
- **DB host**: aws-1-ap-south-1.pooler.supabase.com (Session Pooler, port 5432)
- **GitHub**: github.com/manhvd-smartosc161/concord-family

Login mặc định (đổi sau lần login đầu):
- `manh@concord.local` / `concord-manh`
- `wife@concord.local` / `concord-wife`

## 2. Workflow phát triển → production

### 2.1 Code-only change (không đổi schema)

Quy tắc: **push lên `main` → tự deploy cả Vercel + Render**.

```bash
# Sửa code, test local
pnpm dev

# Commit + push
git add .
git commit -m "feat(web): ..."
git push origin main
```

Sau ~3 phút:
- Vercel build xong, web URL deploy phiên bản mới (rolling, không downtime)
- Render build Docker xong, api restart (~30-60s downtime trên free tier)

Theo dõi:
- Vercel: vercel.com → project `concord` → tab **Deployments**
- Render: dashboard.render.com → service `concord-api` → tab **Events**

### 2.2 Schema change (cần migration mới)

**Quan trọng**: migration **phải chạy local pointing tới Supabase TRƯỚC khi push**, không bao giờ rely vào Render auto-run.

Lý do: nếu migration fail giữa chừng + Render restart container liên tục → schema corrupt, khó rollback.

Quy trình A → Z:

```bash
# 1. Sửa entity trong apps/api/src/modules/<x>/entities/
# 2. Generate migration
pnpm --filter api migration:generate migrations/<TenMigration>

# 3. Mở file migration mới sinh ra, REVIEW SQL kỹ — TypeORM đôi khi
#    sinh DROP COLUMN không mong muốn, hoặc thiếu DEFAULT cho NOT NULL
nano apps/api/migrations/<timestamp>-<TenMigration>.ts

# 4. Test migration local trên DB dev
pnpm --filter api migration:run

# 5. Test app local (pnpm dev) — đảm bảo entity + migration nhất quán

# 6. Chạy migration trên Supabase (production DB)
DATABASE_URL='postgresql://postgres.diucwefjchjdwefvdahk:<PASSWORD_URL_ENCODED>@aws-1-ap-south-1.pooler.supabase.com:5432/postgres' \
POSTGRES_SSL=true \
pnpm --filter api migration:run

# 7. Verify schema qua GUI tool hoặc psql

# 8. CHỈ KHI migration prod OK mới push code
git add apps/api/migrations/
git add apps/api/src/modules/...
git commit -m "feat(api): add <feature> + migration"
git push origin main
```

**Nếu migration prod fail giữa chừng**:
1. KHÔNG push code lên main (api mới reference column chưa có)
2. Connect tay vào Supabase → revert SQL bằng tay (đọc migration file để biết cần DROP gì)
3. Hoặc: `pnpm migration:revert` để gỡ migration đã apply một phần
4. Fix migration file → retry

### 2.3 Đổi env var

| Env var | Đổi ở đâu |
|---|---|
| `NEXT_PUBLIC_API_URL` | Vercel → Project → Settings → Environment Variables. **Cần redeploy** (Next.js bake env build-time). |
| `NEXTAUTH_URL` (CORS) | Render → service → Environment. Auto-restart ~30s. |
| `ANTHROPIC_API_KEY` | Render → service → Environment. Auto-restart. |
| `DATABASE_URL` | Render → service → Environment. Auto-restart. |
| `JWT_SECRET` | Render → service → Environment. **Đổi sẽ làm tất cả token cũ invalid → user phải login lại**. |
| `POSTGRES_SSL` | Render → Environment. Auto-restart. |

Vercel rebuild khi đổi env: project → Deployments → bấm `...` ở deploy mới nhất → **Redeploy** (không cần git push).

### 2.4 Rollback

**Vercel**: project → Deployments → tìm deploy cũ stable → bấm `...` → **Promote to Production**. Instant rollback (no rebuild).

**Render**: service → tab Events → tìm deploy cũ → **Rollback** (nếu có nút) hoặc revert commit:
```bash
git revert <bad-commit-hash>
git push origin main
```

## 3. Logs & monitoring

### 3.1 Xem log

```
Vercel:   project → Logs (real-time) hoặc Deployment → Functions logs
Render:   service → Logs (real-time, search được)
Supabase: project → Logs → Postgres / API / Auth
```

### 3.2 Health check

```bash
# API alive?
curl https://concord-api-49oq.onrender.com/api/auth/me
# Expect 401 (Unauthorized — endpoint live)

# Web alive?
curl -I https://concord-family-web.vercel.app
# Expect 200 OK
```

### 3.3 Cold-start mitigation (Render free)

Render free **sleep sau 15 phút idle**, cold start ~30-60s. Cách giảm:

**Cron-job.org** (free, không cần code):
1. Đăng ký [cron-job.org](https://cron-job.org)
2. Create cronjob:
   - URL: `https://concord-api-49oq.onrender.com/api/auth/me`
   - Schedule: every 14 minutes
3. Save → Render thấy traffic mỗi 14 phút → không sleep

Hoặc **GitHub Actions** (cùng repo, free):
```yaml
# .github/workflows/keep-alive.yml
name: keep-alive
on:
  schedule:
    - cron: '*/14 * * * *'
  workflow_dispatch:
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: curl -fsS https://concord-api-49oq.onrender.com/api/auth/me || true
```

## 4. Database operations

### 4.1 Backup

Supabase free tier có **daily backup tự động** (giữ 7 ngày). Xem ở project → **Database → Backups**. Restore từ đó.

Backup tay xuống local (dump SQL gzipped):
```bash
pg_dump 'postgresql://postgres.diucwefjchjdwefvdahk:<PASSWORD>@aws-1-ap-south-1.pooler.supabase.com:5432/postgres' \
  --no-owner --no-privileges \
  | gzip > backup-$(date -u +%F).sql.gz
```

Upload lên Google Drive định kỳ nếu muốn an toàn ngoài Supabase.

### 4.2 Restore từ dump

```bash
# Drop + recreate (CẨN THẬN — xoá hết data)
psql 'postgresql://postgres.diucwefjchjdwefvdahk:<PASSWORD>@aws-1-ap-south-1.pooler.supabase.com:5432/postgres' \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Restore từ file gz
gunzip -c backup-2026-05-07.sql.gz | psql '<DATABASE_URL>'
```

### 4.3 Reset transactions (giữ users + funds)

Khi muốn xoá hết giao dịch + chat để demo lại, chạy script có sẵn:

```bash
DATABASE_URL='...' POSTGRES_SSL=true pnpm --filter api reset:txn

# Giữ opening balance entries:
DATABASE_URL='...' POSTGRES_SSL=true pnpm --filter api reset:txn -- --keep-opening

# Xoá luôn envelope funds (Du lịch, Đầu tư...):
DATABASE_URL='...' POSTGRES_SSL=true pnpm --filter api reset:txn -- --drop-envelopes
```

### 4.4 Re-seed default data

```bash
DATABASE_URL='...' POSTGRES_SSL=true pnpm --filter api seed
```

Idempotent — chạy nhiều lần không tạo trùng.

## 5. Security maintenance

### 5.1 Rotate Supabase password

Nên làm 6 tháng/lần hoặc sau khi password lộ:

1. Supabase project → **Settings → Database** → **Reset database password**
2. Copy password mới
3. Update env ở Render: `DATABASE_URL` (URL-encode `@` thành `%40`, `!` thành `%21`, etc)
4. Render auto-restart → connection mới được dùng

### 5.2 Rotate Anthropic API key

1. [console.anthropic.com](https://console.anthropic.com/settings/keys) → **Revoke** key cũ
2. **Create Key** mới
3. Update `ANTHROPIC_API_KEY` ở Render → save → auto-restart

### 5.3 Rotate JWT_SECRET

⚠️ Đổi JWT secret → tất cả token đang issued sẽ invalid → 2 vợ chồng phải login lại. Chỉ làm khi nghi ngờ leak.

```bash
openssl rand -hex 32
# Paste vào NEXTAUTH_URL ở Render → save
```

### 5.4 Đổi password user (vợ + chồng)

Sau lần login đầu tiên, đăng nhập web → **Settings → Đổi mật khẩu**. Lưu password manager (Bitwarden free).

## 6. Pricing & limits

| Service | Free tier | Khi nào lo |
|---|---|---|
| Vercel Hobby | Unlimited bandwidth, 100GB-hours/tháng compute | Khi triệu page view/tháng |
| Render free Web | 750h/tháng (đủ 24/7), 512MB RAM, 100GB egress | Khi RAM peak >500MB hoặc egress >100GB |
| Supabase free | 500MB DB, 2GB egress, **auto-pause sau 1 tuần inactive** | Khi DB approach 400MB |
| Anthropic | Pay-per-use | Sonnet 4.6 input ~$3/1M tokens, output ~$15/1M. 2 user / vài chục messages/ngày → ~$1-3/tháng |

Tracking:
- Anthropic: console.anthropic.com → **Usage** dashboard
- Supabase: project → **Settings → Usage**
- Render: dashboard → service → **Metrics**

## 7. Troubleshooting cheatsheet

| Triệu chứng | Nguyên nhân | Fix |
|---|---|---|
| Login fail "Failed to fetch" | API cold-start (Render sleep) | Đợi 30-60s, retry |
| Login fail CORS error | `NEXTAUTH_URL` ở Render sai | Edit → set `https://concord-family-web.vercel.app` không trailing `/` |
| Login fail 401 sau khi đổi `JWT_SECRET` | Token cũ invalid | Logout + login lại |
| API trả 500 sau push code | Migration thiếu | Chạy `pnpm migration:run` pointing prod DB |
| API restart loop, log: SSL error | `DATABASE_URL` có `?sslmode=require` + code config SSL → conflict | Bỏ `?sslmode=require` khỏi URL, giữ `POSTGRES_SSL=true` env |
| API error "self-signed certificate" | Code chưa set `rejectUnauthorized: false` | Đảm bảo `POSTGRES_SSL=true` ở Render env |
| API error "ERR_PNPM_DEPLOY_NONINJECTED_WORKSPACE" | pnpm v10 deploy semantics | Dockerfile dùng `--legacy` flag (đã có) |
| Web build fail "Cannot find @/lib/..." | Vercel root dir sai | Project Settings → Root Directory phải là `apps/web` |
| Web hiện stale data sau deploy | Browser cache | Hard refresh: Cmd+Shift+R |
| Supabase DB pause | Inactive >1 tuần | Login Supabase dashboard 1 lần → wake; setup keep-alive cron như §3.3 |

## 8. Local dev pointing prod DB (debug only)

⚠️ Cẩn thận — write từ local sẽ ảnh hưởng prod data.

```bash
# Read-only inspect
psql '<DATABASE_URL>'

# Run NestJS local pointing Supabase (test bug khó repro)
cd apps/api
DATABASE_URL='...' POSTGRES_SSL=true pnpm start:dev
# (Web local localhost:3000 vẫn gọi API local localhost:3001)
```

## 9. Khi muốn tự host (migrate khỏi Render/Vercel)

Tham khảo [`docs/`](.) — em viết guide Oracle Cloud Always Free hoặc Hetzner VPS sau nếu cần. Migration:
1. `pg_dump` Supabase → file
2. Spin VM mới → docker-compose up Postgres + API + Web + Caddy
3. `psql` import dump
4. Đổi DNS → done
