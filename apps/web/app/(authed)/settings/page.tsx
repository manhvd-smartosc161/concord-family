'use client';

import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { useAuthedLayout } from '../layout';
import { ChangePasswordModal } from '@/features/auth/components/change-password-modal';
import { updateProfile, uploadAvatar } from '@/features/auth/api';
import { UserAvatar } from '@/features/auth/components/user-avatar';
import {
  Card,
  PageHeader,
  Skeleton,
} from '@/components/ui';

export default function SettingsPage() {
  const { user } = useAuthedLayout();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Cài đặt"
        subtitle="Tài khoản, mật khẩu và quy tắc lương"
      />
      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <AccountSection />
          <p className="text-center text-[11px] text-stone-400">
            User ID:{' '}
            <span className="font-mono">{user.id.slice(0, 8)}…</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Account section ──────────────────────────────────────────────────

function AccountSection() {
  const { user, reloadUser } = useAuthedLayout();
  const [pwOpen, setPwOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  const [name, setName] = useState(user.name);
  const [birthdate, setBirthdate] = useState(user.birthdate ?? '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const isDirty =
    name.trim() !== user.name ||
    (birthdate || null) !== (user.birthdate ?? null) ||
    avatarFile !== null;

  function handleEnterEdit() {
    setName(user.name);
    setBirthdate(user.birthdate ?? '');
    setAvatarFile(null);
    setAvatarPreview(null);
    setAvatarError(null);
    setError(null);
    setEditing(true);
  }

  function handleCancel() {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(null);
    setAvatarPreview(null);
    setAvatarError(null);
    setError(null);
    setEditing(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setAvatarError('Chỉ chấp nhận JPEG, PNG hoặc WebP');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Ảnh phải nhỏ hơn 5MB');
      return;
    }
    setAvatarError(null);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    e.target.value = '';
  }

  async function handleSave() {
    if (!isDirty || saving) return;
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (avatarFile) {
        await uploadAvatar(avatarFile);
      }
      const nameChanged = name.trim() !== user.name;
      const bdChanged = (birthdate || null) !== (user.birthdate ?? null);
      if (nameChanged || bdChanged) {
        await updateProfile({
          name: name.trim(),
          birthdate: birthdate || null,
        });
      }
      await reloadUser();
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarFile(null);
      setAvatarPreview(null);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setSaving(false);
    }
  }

  const displayAvatar = avatarPreview
    ? { ...user, avatarUrl: avatarPreview }
    : user;

  return (
    <Card padding="p-6">
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h3 className="mb-1 text-sm font-semibold text-stone-800">Tài khoản</h3>
          {!editing && (
            <p className="hidden text-xs text-stone-500 sm:block">
              Concord là couple-only — mỗi instance chỉ có 2 tài khoản (vợ + chồng).
            </p>
          )}
        </div>
        {!editing && (
          <button
            onClick={handleEnterEdit}
            className="shrink-0 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50"
          >
            ✏️ Chỉnh sửa
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-2">
            <input
              id="avatar-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
            <label htmlFor="avatar-input" className="cursor-pointer">
              <UserAvatar user={displayAvatar} size={80} editable />
            </label>
            {avatarError && (
              <p className="text-xs text-rose-600">{avatarError}</p>
            )}
            <p className="text-[11px] text-stone-400">Bấm vào ảnh để thay đổi</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-stone-500">
                Tên
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm transition-colors focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-stone-500">
                Ngày sinh
              </label>
              <input
                type="date"
                value={birthdate}
                max={today}
                onChange={(e) => setBirthdate(e.target.value)}
                className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm transition-colors focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <Field label="Vai trò" value={user.role === 'husband' ? 'Chồng' : 'Vợ'} />
            <Field label="Email" value={user.email} mono />
          </div>

          {error && <p className="text-xs text-rose-600">⚠️ {error}</p>}

          <div className="flex justify-end gap-2 border-t border-stone-100 pt-4">
            <button
              onClick={handleCancel}
              disabled={saving}
              className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50"
            >
              Huỷ
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !isDirty || !name.trim()}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-800 active:scale-[0.99] disabled:bg-stone-300"
            >
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-5 flex items-center gap-4">
            <UserAvatar user={user} size={56} />
            <div>
              <div className="text-base font-semibold text-stone-900">{user.name}</div>
              <div className="text-xs text-stone-500">
                {user.role === 'husband' ? 'Chồng' : 'Vợ'} · {user.email}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Ngày sinh"
              value={
                user.birthdate
                  ? new Date(user.birthdate + 'T00:00:00').toLocaleDateString('vi-VN')
                  : '—'
              }
            />
            <Field label="ID" value={user.id.slice(0, 8) + '…'} mono small />
          </div>

          <div className="mt-5 flex justify-end border-t border-stone-100 pt-4">
            <button
              onClick={() => setPwOpen(true)}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-800 active:scale-[0.99]"
            >
              🔐 Đổi mật khẩu
            </button>
          </div>
        </>
      )}

      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </Card>
  );
}

function Field({
  label,
  value,
  mono,
  small,
}: {
  label: string;
  value: string;
  mono?: boolean;
  small?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
        {label}
      </div>
      <div
        className={`mt-1 ${mono ? 'font-mono' : ''} ${small ? 'text-xs' : 'text-sm'} text-stone-800`}
      >
        {value}
      </div>
    </div>
  );
}

