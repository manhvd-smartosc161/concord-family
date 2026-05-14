'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { setToken } from '@/lib/api-client';
import { updateProfile } from '@/features/auth/api';
import { useAuthedLayout } from '../../layout';
import {
  createInvitation,
  getMyFamily,
  leaveFamily,
  updateFamily,
} from '@/features/families/api';
import type {
  CreateInvitationResponse,
  FamilyMember,
  FamilyMembersView,
} from '@/features/families/types';

export default function FamilyInvitePage() {
  const t = useTranslations('family');
  const tCommon = useTranslations('common');
  const { user } = useAuthedLayout();
  const [view, setView] = useState<FamilyMembersView | null>(null);
  const [email, setEmail] = useState('');
  const [invitation, setInvitation] = useState<CreateInvitationResponse | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [editingFamily, setEditingFamily] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);

  async function reload() {
    try {
      const v = await getMyFamily();
      setView(v);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được gia đình');
    }
  }

  useEffect(() => {
    void reload();
    const id = setInterval(() => void reload(), 5000);
    return () => clearInterval(id);
  }, []);

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const inv = await createInvitation(email.trim());
      setInvitation(inv);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gửi mời thất bại');
    } finally {
      setSubmitting(false);
    }
  }

  async function copyLink() {
    if (!invitation) return;
    await navigator.clipboard.writeText(invitation.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function onLeave() {
    if (!confirm(t('leave_confirm'))) return;
    setLeaving(true);
    setError(null);
    try {
      const res = await leaveFamily();
      setToken(res.accessToken);
      window.location.assign('/family/setup');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Thoát thất bại');
      setLeaving(false);
    }
  }

  if (!view) {
    return (
      <main className="flex min-h-full items-center justify-center text-sm text-muted-foreground">
        {tCommon('loading')}
      </main>
    );
  }

  const isComplete = view.members.length === 2;

  return (
    <main className="min-h-full bg-background px-3 py-6 sm:px-4 lg:px-6 lg:py-8">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              🏠 {view.family.name} — {t('invite_title')}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('members_count', { count: view.members.length })} ·{' '}
              {isComplete ? t('complete') : t('waiting_spouse')}
            </p>
          </div>
          {!editingFamily && (
            <button
              type="button"
              onClick={() => setEditingFamily(true)}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            >
              ✏️ {t('edit')}
            </button>
          )}
        </div>

        {editingFamily && (
          <EditFamilyForm
            initialName={view.family.name}
            initialWedding={view.family.weddingDate ?? ''}
            onCancel={() => setEditingFamily(false)}
            onSaved={async () => {
              setEditingFamily(false);
              await reload();
            }}
          />
        )}

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('members_section')}
          </div>
          <ul className="mt-3 divide-y divide-border">
            {view.members.map((m) => {
              const isMe = m.id === user.id;
              if (isMe && editingProfile) {
                return (
                  <li key={m.id} className="py-3">
                    <EditProfileForm
                      initialName={m.name}
                      initialBirthdate={m.birthdate ?? ''}
                      onCancel={() => setEditingProfile(false)}
                      onSaved={async () => {
                        setEditingProfile(false);
                        await reload();
                      }}
                    />
                  </li>
                );
              }
              return (
                <MemberRow
                  key={m.id}
                  member={m}
                  canEdit={isMe}
                  onEdit={() => setEditingProfile(true)}
                />
              );
            })}
            {!isComplete && (
              <li className="py-3 text-sm italic text-muted-foreground">
                {t('waiting_spouse_slot')}
              </li>
            )}
          </ul>
        </div>

        {view.family.weddingDate && !editingFamily && (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="flex items-center gap-2">
              <span className="text-xl">💍</span>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t('wedding_date_section')}
                </div>
                <div className="text-sm font-medium text-foreground">
                  {formatDate(view.family.weddingDate)}
                </div>
              </div>
            </div>
          </div>
        )}

        {!isComplete && !invitation && (
          <form
            onSubmit={onInvite}
            className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
          >
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                {t('invite_email_label')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="vochong@gmail.com"
                className="w-full rounded-lg border border-input bg-muted px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:bg-background focus:outline-none focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900"
                disabled={submitting}
              />
            </div>
            {error && (
              <div className="rounded-lg border border-rose-200 dark:border-rose-900 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:bg-muted sm:w-auto"
            >
              {submitting ? t('creating_link') : t('send_link')}
            </button>
          </form>
        )}

        {!isComplete && invitation && (
          <div className="space-y-3 rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 p-4 sm:p-5">
            <div className="text-sm font-medium text-emerald-900 dark:text-emerald-300">
              ✅ {t('invite_sent')} <strong>{invitation.email}</strong>
            </div>
            <p className="text-xs text-emerald-800 dark:text-emerald-400">
              {t('invite_fallback_hint')}
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-emerald-300 dark:border-emerald-900 bg-background p-2">
              <input
                value={invitation.link}
                readOnly
                className="flex-1 bg-transparent font-mono text-[11px] text-foreground focus:outline-none"
              />
              <button
                type="button"
                onClick={copyLink}
                className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700"
              >
                {copied ? t('copied') : t('copy')}
              </button>
            </div>
            <p className="text-[11px] italic text-emerald-700 dark:text-emerald-400">
              {t('invite_accepted_hint')}
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-4 sm:p-5">
          <div className="text-sm font-semibold text-rose-900 dark:text-rose-300">
            ⚠️ {t('leave_family')}
          </div>
          <p className="mt-1 text-xs text-rose-800 dark:text-rose-400">
            {t('leave_desc')}
          </p>
          <button
            type="button"
            onClick={onLeave}
            disabled={leaving}
            className="mt-3 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {leaving ? tCommon('saving') : t('leave_family')}
          </button>
        </div>
      </div>
    </main>
  );
}

function MemberRow({
  member,
  canEdit,
  onEdit,
}: {
  member: FamilyMember;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const t = useTranslations('family');
  const tAuth = useTranslations('auth');
  const roleLabel =
    member.role === 'husband' ? tAuth('husband') : member.role === 'wife' ? tAuth('wife') : '—';
  const genderIcon = member.gender === 'male' ? '👨' : '👩';
  return (
    <li className="flex items-start gap-3 py-3">
      <span className="text-2xl">{genderIcon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {member.name}
          </span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {roleLabel}
          </span>
          {canEdit && (
            <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
              {t('you_badge')}
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {member.email}
        </div>
        {member.birthdate ? (
          <div className="mt-1 text-[11px] text-muted-foreground">
            🎂 {t('birthday_label')} {formatDate(member.birthdate)}
          </div>
        ) : canEdit ? (
          <div className="mt-1 text-[11px] italic text-muted-foreground">
            {t('no_birthday')}
          </div>
        ) : null}
      </div>
      {canEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
        >
          {t('edit')}
        </button>
      )}
    </li>
  );
}

function EditFamilyForm({
  initialName,
  initialWedding,
  onCancel,
  onSaved,
}: {
  initialName: string;
  initialWedding: string;
  onCancel: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const t = useTranslations('family');
  const tCommon = useTranslations('common');
  const [name, setName] = useState(initialName);
  const [wedding, setWedding] = useState(initialWedding);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      await updateFamily({
        name: name.trim(),
        weddingDate: wedding ? wedding : null,
      });
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-card p-4 shadow-sm sm:p-5"
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
        {t('edit_family_title')}
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          {t('family_name_label')}
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={120}
          className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm focus:border-emerald-500 focus:bg-background focus:outline-none focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900"
          disabled={saving}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          {t('wedding_label')}
        </label>
        <input
          type="date"
          value={wedding}
          onChange={(e) => setWedding(e.target.value)}
          className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm focus:border-emerald-500 focus:bg-background focus:outline-none focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900"
          disabled={saving}
        />
        <p className="mt-1 text-[10px] text-muted-foreground">
          {t('wedding_clear_hint')}
        </p>
      </div>
      {err && (
        <div className="rounded-lg border border-rose-200 dark:border-rose-900 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {err}
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
        >
          {tCommon('cancel')}
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:bg-muted"
        >
          {saving ? tCommon('saving') : tCommon('save')}
        </button>
      </div>
    </form>
  );
}

function EditProfileForm({
  initialName,
  initialBirthdate,
  onCancel,
  onSaved,
}: {
  initialName: string;
  initialBirthdate: string;
  onCancel: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const t = useTranslations('family');
  const tCommon = useTranslations('common');
  const [name, setName] = useState(initialName);
  const [birthdate, setBirthdate] = useState(initialBirthdate);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      await updateProfile({
        name: name.trim(),
        birthdate: birthdate ? birthdate : null,
      });
      await onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
        {t('edit_profile_title')}
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          {t('display_name_label')}
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={80}
          className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm focus:border-emerald-500 focus:bg-background focus:outline-none focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900"
          disabled={saving}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          {t('birthdate_label_form')}
        </label>
        <input
          type="date"
          value={birthdate}
          onChange={(e) => setBirthdate(e.target.value)}
          className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm focus:border-emerald-500 focus:bg-background focus:outline-none focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900"
          disabled={saving}
        />
      </div>
      {err && (
        <div className="rounded-lg border border-rose-200 dark:border-rose-900 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {err}
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
        >
          {tCommon('cancel')}
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:bg-muted"
        >
          {saving ? tCommon('saving') : tCommon('save')}
        </button>
      </div>
    </form>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${parseInt(d, 10)}/${parseInt(m, 10)}/${y}`;
}
