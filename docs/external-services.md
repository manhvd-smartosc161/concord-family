# External Services — Concord

Danh sách tất cả service bên ngoài project đang dùng, vai trò, tier, và link quản lý.

## Tổng quan kiến trúc

```
Browser
  └─> Vercel (Next.js web)
        └─> Render (NestJS API)
              ├─> Supabase (PostgreSQL + pgvector)
              └─> Anthropic API (Claude AI)

SendGrid ←── Render (email notifications)
UptimeRobot ──> Render (keep-alive ping mỗi 5 phút)
GitHub ──> Vercel + Render (auto-deploy khi push main)
```

---

## 1. Vercel — Frontend Hosting

**URL quản lý**: vercel.com → project `concord-family-web`

**Làm gì**: Host Next.js app (`apps/web`). Auto-deploy mỗi khi push lên `main`.
Build xong trong ~2 phút, rolling deploy không downtime.

**URL production**: https://concord-family-web.vercel.app

**Tier**: Hobby (miễn phí)
- Unlimited bandwidth
- 100 GB-hours/tháng serverless compute
- Auto SSL

**Env vars cần set ở đây**:
| Var | Giá trị |
|-----|---------|
| `NEXT_PUBLIC_API_URL` | `https://concord-api-49oq.onrender.com` |
| `NEXTAUTH_URL` | `https://concord-family-web.vercel.app` |
| `NEXTAUTH_SECRET` | random string |

> Đổi `NEXT_PUBLIC_API_URL` phải **redeploy** vì Next.js bake env lúc build.

---

## 2. Render — Backend Hosting

**URL quản lý**: dashboard.render.com → service `concord-api-49oq`

**Làm gì**: Chạy NestJS API (`apps/api`) trong Docker container. Auto-deploy khi push `main`.
Mỗi lần deploy, container start → chạy migration TypeORM → serve traffic.

**URL production**: https://concord-api-49oq.onrender.com

**Tier**: Free Web Service
- 750h compute/tháng (đủ 24/7)
- 512MB RAM
- 100GB egress/tháng
- **Sleep sau 15 phút idle** → cold start 30-60s lần đầu

**Env vars cần set ở đây**:
| Var | Mô tả |
|-----|-------|
| `DATABASE_URL` | Connection string Supabase (Session Pooler) |
| `POSTGRES_SSL` | `true` |
| `ANTHROPIC_API_KEY` | Key từ console.anthropic.com |
| `JWT_SECRET` | Random string dài, không đổi tùy tiện (invalidate token) |
| `JWT_EXPIRES_IN` | `7d` |
| `NEXTAUTH_URL` | URL web Vercel (dùng cho CORS) |
| `SENDGRID_API_KEY` | Key từ SendGrid |
| `SENDGRID_FROM` | Email sender đã verify |
| `NODE_ENV` | `production` |

---

## 3. Supabase — Database (PostgreSQL + pgvector)

**URL quản lý**: supabase.com → project `concord-family`

**Làm gì**: PostgreSQL 16 với extension pgvector. Lưu toàn bộ data: users, funds,
transactions, categories, goals, chat history. pgvector dùng cho embeddings (planned).

**Connection**: Session Pooler `aws-1-ap-south-1.pooler.supabase.com:5432`

**Tier**: Free
- 500MB storage
- 2GB egress/tháng
- Daily backup tự động, giữ 7 ngày
- **Auto-pause sau 7 ngày không có request** → login Supabase dashboard để wake

**Xem DB usage**: project → Settings → Usage

**Backup thủ công**:
```bash
pg_dump '<DATABASE_URL>' --no-owner --no-privileges | gzip > backup-$(date -u +%F).sql.gz
```

---

## 4. Anthropic API — Claude AI

**URL quản lý**: console.anthropic.com

**Làm gì**: Cung cấp LLM cho toàn bộ AI features trong app:
- **Claude Sonnet 4.6** (`claude-sonnet-4-6`): reasoning agent, advisor, monthly reporter, anomaly detection
- **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`): transaction parser, category classifier (fast + cheap)

**Tier**: Pay-per-use
- Sonnet 4.6: ~$3/1M input tokens, ~$15/1M output tokens
- Haiku 4.5: rẻ hơn ~10x so với Sonnet
- Ước tính 2 user dùng bình thường: **~$1–3/tháng**

**Theo dõi chi phí**: console.anthropic.com → **Usage**

**Rotate key**: console.anthropic.com → Settings → API Keys → Revoke cũ → Create mới → update Render env.

---

## 5. SendGrid — Email

**URL quản lý**: app.sendgrid.com

**Làm gì**: Gửi email transactional (hiện tại: planned, module sẵn sàng nhưng chưa có
flow nào trigger). Khi cần: password reset, monthly report qua email.

**Tier**: Free
- 100 email/ngày
- Yêu cầu verify sender email tại **Sender Authentication → Single Sender**

**Env vars**:
- `SENDGRID_API_KEY`: key dạng `SG.xxx`
- `SENDGRID_FROM`: email đã verify, ví dụ `Concord <manhvd161@gmail.com>`

---

## 6. UptimeRobot — Keep-Alive Monitor

**URL quản lý**: uptimerobot.com

**Làm gì**: Ping API Render mỗi 5 phút để tránh Render free tier sleep.
Đồng thời alert qua email nếu API thực sự down.

**Monitor đang setup**:
- URL: `https://concord-api-49oq.onrender.com/api/auth/me`
- Interval: 5 phút
- Expected: HTTP 401 (endpoint live, token missing — bình thường)

**Tier**: Free
- 50 monitors
- 5 phút interval (đủ cho mục đích này)

---

## 7. GitHub — Source Control & CI/CD

**URL**: github.com/manhvd-smartosc161/concord-family

**Làm gì**: Lưu source code. Push lên `main` tự động trigger deploy:
- **Vercel** connect GitHub → detect push → build `apps/web` → deploy
- **Render** connect GitHub → detect push → build Docker → deploy `apps/api`

**Không cần** setup thêm gì — cả Vercel và Render đã link vào repo qua OAuth.

---

## Bảng tóm tắt chi phí

| Service | Tier | Chi phí/tháng | Giới hạn cần chú ý |
|---------|------|--------------|---------------------|
| Vercel | Hobby | Miễn phí | 100 GB-hours compute |
| Render | Free | Miễn phí | 512MB RAM, sleep 15min idle |
| Supabase | Free | Miễn phí | 500MB DB, pause sau 7 ngày idle |
| Anthropic | Pay-per-use | ~$1–3 | Theo usage thực tế |
| SendGrid | Free | Miễn phí | 100 email/ngày |
| UptimeRobot | Free | Miễn phí | Interval 5 phút |
| GitHub | Free | Miễn phí | Unlimited public/private |

**Tổng ước tính**: ~$1–3/tháng (chỉ Anthropic là có chi phí biến đổi)
