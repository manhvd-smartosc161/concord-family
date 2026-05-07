'use client';

import { useState } from 'react';
import { ChangePasswordModal } from '@/features/auth/components/change-password-modal';
import type { AuthUser } from '@/features/auth/types';

export function Header({
  user,
  onLogout,
}: {
  user: AuthUser;
  onLogout: () => void;
}) {
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
