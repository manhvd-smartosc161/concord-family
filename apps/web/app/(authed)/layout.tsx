'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  formatVND,
  listFunds,
  type AuthUser,
  type FundView,
} from '../../lib/api';
import { logout, useAuth } from '../../lib/use-auth';
import { ChangePasswordModal } from './_components/change-password-modal';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/chat', label: 'Chat', icon: '💬' },
  { href: '/transactions', label: 'Giao dịch', icon: '📒' },
  { href: '/reports', label: 'Báo cáo', icon: '📈' },
  { href: '/goals', label: 'Mục tiêu', icon: '🎯' },
  { href: '/settings', label: 'Cài đặt', icon: '⚙️' },
];

// ─── Layout context (for child pages to refresh funds after action) ─────

interface LayoutCtx {
  user: AuthUser;
  funds: FundView[];
  reloadFunds: () => Promise<void>;
}

const LayoutContext = createContext<LayoutCtx | null>(null);

export function useAuthedLayout(): LayoutCtx {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error('useAuthedLayout must be used inside (authed)');
  return ctx;
}

// ─── Layout ─────────────────────────────────────────────────────────────

export default function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = useAuth();
  const router = useRouter();
  const [funds, setFunds] = useState<FundView[]>([]);

  const reloadFunds = useCallback(async () => {
    try {
      const next = await listFunds();
      setFunds(next);
    } catch {
      /* useAuth will redirect on 401 */
    }
  }, []);

  useEffect(() => {
    if (auth.status === 'authed') void reloadFunds();
  }, [auth.status, reloadFunds]);

  if (auth.status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-stone-400">
          <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-emerald-500" />
          <span className="text-sm">Đang xác thực…</span>
        </div>
      </div>
    );
  }
  if (auth.status === 'unauthed') return null; // useAuth already redirects

  return (
    <LayoutContext.Provider
      value={{ user: auth.user, funds, reloadFunds }}
    >
      <div className="grid h-screen grid-cols-[280px_minmax(0,1fr)] grid-rows-[64px_minmax(0,1fr)]">
        <Header user={auth.user} onLogout={() => logout(router)} />
        <Sidebar funds={funds} />
        <main className="min-h-0 overflow-hidden bg-stone-50">
          {children}
        </main>
      </div>
    </LayoutContext.Provider>
  );
}

// ─── Header ─────────────────────────────────────────────────────────────

function Header({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const [pwModalOpen, setPwModalOpen] = useState(false);
  return (
    <header className="col-span-2 flex items-center justify-between border-b border-stone-200 bg-white/80 px-6 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-700 text-base font-bold text-white shadow-sm shadow-emerald-700/20">
          C
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-stone-900">Concord</div>
          <div className="text-[11px] text-stone-500">Couple finance agent</div>
        </div>
      </div>

      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 transition-colors hover:border-stone-200 hover:bg-stone-50"
        >
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
              user.role === 'husband'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="text-left leading-tight">
            <div className="text-sm font-medium text-stone-800">
              {user.name}
            </div>
            <div className="text-[11px] text-stone-500">
              {user.role === 'husband' ? 'Chồng' : 'Vợ'} · {user.email}
            </div>
          </div>
          <svg
            className={`h-4 w-4 text-stone-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {open && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setOpen(false)}
            />
            <div className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-lg border border-stone-200 bg-white shadow-lg">
              <button
                onClick={() => {
                  setOpen(false);
                  setPwModalOpen(true);
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-stone-700 transition-colors hover:bg-stone-50"
              >
                <span>🔐</span> Đổi mật khẩu
              </button>
              <div className="border-t border-stone-100" />
              <button
                onClick={onLogout}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-stone-700 transition-colors hover:bg-rose-50 hover:text-rose-700"
              >
                <span>🚪</span> Đăng xuất
              </button>
            </div>
          </>
        )}
      </div>

      <ChangePasswordModal
        open={pwModalOpen}
        onClose={() => setPwModalOpen(false)}
      />
    </header>
  );
}

// ─── Sidebar ────────────────────────────────────────────────────────────

function Sidebar({ funds }: { funds: FundView[] }) {
  const pathname = usePathname();
  return (
    <aside className="flex flex-col overflow-y-auto border-r border-stone-200 bg-white">
      <nav className="space-y-0.5 p-3">
        {NAV.map((n) => {
          const active = pathname === n.href;
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? 'bg-emerald-50 font-medium text-emerald-900'
                  : 'text-stone-700 hover:bg-stone-100'
              }`}
            >
              <span className="text-base">{n.icon}</span>
              {n.label}
            </Link>
          );
        })}
      </nav>

      <div className="mx-3 my-2 border-t border-stone-100" />

      <div className="space-y-2 px-3">
        <h3 className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400">
          Quỹ của bạn
        </h3>
        {funds.length === 0 && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-[68px] animate-pulse rounded-lg bg-stone-100"
              />
            ))}
          </div>
        )}
        {funds.map((f) => (
          <FundCard key={f.id} fund={f} />
        ))}
      </div>

      <div className="mt-auto p-3 text-[10px] leading-relaxed text-stone-400">
        MVP Tuần 1 · Parser subagent (Haiku 4.5) · Auth JWT
      </div>
    </aside>
  );
}

/** Pick icon dựa trên tên envelope (keyword match) hoặc fallback theo loại quỹ. */
export function pickFundIcon(fund: {
  name: string;
  type: 'personal' | 'joint';
  purpose: 'general' | 'envelope';
  accessLevel: 'owner' | 'joint' | 'private';
}): string {
  if (fund.accessLevel === 'private') return '🔒';
  if (fund.purpose === 'general') {
    return fund.type === 'joint' ? '🤝' : '💰';
  }
  // envelope — match keyword in name
  const n = fund.name.toLowerCase();
  if (/du l[ịi]ch|travel|nghỉ|nghi/.test(n)) return '✈️';
  if (/sửa nh[àa]|nhà|home|build/.test(n)) return '🏠';
  if (/học|education|sóc|con|trường|school|cấp/.test(n)) return '📚';
  if (/đầu tư|invest|stock|chứng khoán/.test(n)) return '📈';
  if (/tiết kiệm|savings|ti[êe]́t/.test(n)) return '🐷';
  if (/y tế|sức khỏe|sức khoẻ|health|khám|thuốc/.test(n)) return '🏥';
  if (/xe|ô tô|car|moto|honda/.test(n)) return '🚗';
  if (/cưới|hỏi|wedding/.test(n)) return '💍';
  if (/khẩn cấp|emergency|dự phòng/.test(n)) return '🆘';
  if (/quà|tặng|gift/.test(n)) return '🎁';
  if (/tết|new year/.test(n)) return '🧧';
  if (/sinh nhật|birthday/.test(n)) return '🎂';
  if (/điện tử|tech|máy/.test(n)) return '💻';
  // Hash-based fallback để mỗi envelope có icon khác nhau
  const fallbacks = ['🎯', '⭐', '💎', '🌱', '🪙', '🌟', '🎨', '🧭'];
  let h = 0;
  for (let i = 0; i < fund.name.length; i++) h = (h * 31 + fund.name.charCodeAt(i)) | 0;
  return fallbacks[Math.abs(h) % fallbacks.length];
}

function FundCard({ fund }: { fund: FundView }) {
  const isPrivate = fund.accessLevel === 'private';
  const variant = {
    owner:
      'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white',
    joint:
      fund.purpose === 'envelope'
        ? 'border-sky-200 bg-gradient-to-br from-sky-50 to-white'
        : 'border-amber-200 bg-gradient-to-br from-amber-50 to-white',
    private: 'border-stone-200 bg-stone-50',
  }[fund.accessLevel];

  const icon = pickFundIcon(fund);
  const label =
    fund.accessLevel === 'owner'
      ? 'Của bạn'
      : fund.accessLevel === 'joint'
        ? fund.purpose === 'envelope'
          ? 'Mục tiêu'
          : 'Chung'
        : 'Riêng tư';

  return (
    <div className={`rounded-lg border ${variant} p-3`}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium text-stone-800">
          <span>{icon}</span> {fund.name}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-stone-400">
          {label}
        </span>
      </div>
      <div className="mt-1 font-mono text-base font-semibold tabular-nums">
        {isPrivate ? (
          <span className="text-stone-300">— — — đ</span>
        ) : (
          <span className="text-stone-900">{formatVND(fund.balance ?? 0)}</span>
        )}
      </div>
    </div>
  );
}
