'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('settings');

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
      />
      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <AccountSection />
          <p className="text-center text-[11px] text-muted-foreground">
            {t('user_id')}:{' '}
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
  const t = useTranslations('settings');
  const tAuth = useTranslations('auth');
  const tCommon = useTranslations('common');
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
      setAvatarError(t('avatar_invalid_type'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError(t('avatar_too_large'));
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
      setError(err instanceof Error ? err.message : tCommon('error'));
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
          <h3 className="mb-1 text-sm font-semibold text-foreground">{t('account')}</h3>
          {!editing && (
            <p className="hidden text-xs text-muted-foreground sm:block">
              {t('couple_only_note')}
            </p>
          )}
        </div>
        {!editing && (
          <button
            onClick={handleEnterEdit}
            className="shrink-0 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            {t('click_edit')}
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
              <p className="text-xs text-destructive">{avatarError}</p>
            )}
            <p className="text-[11px] text-muted-foreground">{t('click_to_change_avatar')}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {tAuth('name')}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm transition-colors focus:border-emerald-500 focus:bg-background focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {tAuth('birthdate')}
              </label>
              <input
                type="date"
                value={birthdate}
                max={today}
                onChange={(e) => setBirthdate(e.target.value)}
                className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm transition-colors focus:border-emerald-500 focus:bg-background focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <Field label={t('role_label')} value={user.role === 'husband' ? tAuth('husband') : tAuth('wife')} />
            <Field label={t('email_label')} value={user.email} mono />
          </div>

          {error && <p className="text-xs text-destructive">⚠️ {error}</p>}

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button
              onClick={handleCancel}
              disabled={saving}
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              {tCommon('cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !isDirty || !name.trim()}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-800 active:scale-[0.99] disabled:bg-muted"
            >
              {saving ? tCommon('saving') : tCommon('save')}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-5 flex items-center gap-4">
            <UserAvatar user={user} size={56} />
            <div>
              <div className="text-base font-semibold text-foreground">{user.name}</div>
              <div className="text-xs text-muted-foreground">
                {user.role === 'husband' ? tAuth('husband') : tAuth('wife')} · {user.email}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label={tAuth('birthdate')}
              value={
                user.birthdate
                  ? new Date(user.birthdate + 'T00:00:00').toLocaleDateString('vi-VN')
                  : '—'
              }
            />
            <Field label={t('id_label')} value={user.id.slice(0, 8) + '…'} mono small />
          </div>

          <div className="mt-5 flex justify-end border-t border-border pt-4">
            <button
              onClick={() => setPwOpen(true)}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-800 active:scale-[0.99]"
            >
              🔐 {tAuth('change_password')}
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
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 ${mono ? 'font-mono' : ''} ${small ? 'text-xs' : 'text-sm'} text-foreground`}
      >
        {value}
      </div>
    </div>
  );
}

