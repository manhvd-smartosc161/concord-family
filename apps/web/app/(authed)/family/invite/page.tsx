'use client';

import { useEffect, useState } from 'react';
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
    if (
      !confirm(
        'Bạn chắc chắn muốn thoát gia đình? Quỹ riêng và chat của bạn sẽ bị xoá vĩnh viễn.',
      )
    )
      return;
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
      <main className="flex min-h-full items-center justify-center text-sm text-stone-400">
        Đang tải…
      </main>
    );
  }

  const isComplete = view.members.length === 2;

  return (
    <main className="min-h-full bg-stone-50 px-3 py-6 sm:px-4 lg:px-6 lg:py-8">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold text-stone-900">
              🏠 {view.family.name}
            </h1>
            <p className="mt-1 text-xs text-stone-500">
              {view.members.length}/2 thành viên ·{' '}
              {isComplete ? 'Hoàn chỉnh' : 'Đang chờ vợ/chồng tham gia'}
            </p>
          </div>
          {!editingFamily && (
            <button
              type="button"
              onClick={() => setEditingFamily(true)}
              className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50"
            >
              ✏️ Sửa
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

        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">
            Thành viên
          </div>
          <ul className="mt-3 divide-y divide-stone-100">
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
              <li className="py-3 text-sm italic text-stone-400">
                (chỗ trống — đợi vợ/chồng tham gia)
              </li>
            )}
          </ul>
        </div>

        {view.family.weddingDate && !editingFamily && (
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center gap-2">
              <span className="text-xl">💍</span>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Ngày cưới
                </div>
                <div className="text-sm font-medium text-stone-800">
                  {formatDate(view.family.weddingDate)}
                </div>
              </div>
            </div>
          </div>
        )}

        {!isComplete && !invitation && (
          <form
            onSubmit={onInvite}
            className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5"
          >
            <div>
              <label className="mb-1.5 block text-xs font-medium text-stone-700">
                Mời vợ/chồng qua email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="vochong@gmail.com"
                className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
                disabled={submitting}
              />
            </div>
            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:bg-stone-300 sm:w-auto"
            >
              {submitting ? 'Đang tạo link…' : 'Gửi link mời'}
            </button>
          </form>
        )}

        {!isComplete && invitation && (
          <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
            <div className="text-sm font-medium text-emerald-900">
              ✅ Đã gửi email mời tới <strong>{invitation.email}</strong>
            </div>
            <p className="text-xs text-emerald-800">
              Nếu vợ/chồng không nhận được (kiểm tra Spam), có thể copy link
              bên dưới gửi tay (Zalo/Messenger):
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-white p-2">
              <input
                value={invitation.link}
                readOnly
                className="flex-1 bg-transparent font-mono text-[11px] text-stone-700 focus:outline-none"
              />
              <button
                type="button"
                onClick={copyLink}
                className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700"
              >
                {copied ? '✓ Đã copy' : 'Copy'}
              </button>
            </div>
            <p className="text-[11px] italic text-emerald-700">
              Khi vợ/chồng accept link, dashboard tự cập nhật quỹ.
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:p-5">
          <div className="text-sm font-semibold text-rose-900">
            ⚠️ Thoát gia đình
          </div>
          <p className="mt-1 text-xs text-rose-800">
            Quỹ riêng + chat của bạn sẽ bị xoá vĩnh viễn. Quỹ chung và dữ liệu
            chia sẻ ở lại với người còn lại. Nếu bạn là thành viên cuối, gia
            đình sẽ bị xoá hoàn toàn.
          </p>
          <button
            type="button"
            onClick={onLeave}
            disabled={leaving}
            className="mt-3 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {leaving ? 'Đang xử lý…' : 'Thoát gia đình'}
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
  const roleLabel =
    member.role === 'husband' ? 'Chồng' : member.role === 'wife' ? 'Vợ' : '—';
  const genderIcon = member.gender === 'male' ? '👨' : '👩';
  return (
    <li className="flex items-start gap-3 py-3">
      <span className="text-2xl">{genderIcon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-stone-800">
            {member.name}
          </span>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-stone-600">
            {roleLabel}
          </span>
          {canEdit && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
              Bạn
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-xs text-stone-500">
          {member.email}
        </div>
        {member.birthdate ? (
          <div className="mt-1 text-[11px] text-stone-500">
            🎂 Sinh nhật: {formatDate(member.birthdate)}
          </div>
        ) : canEdit ? (
          <div className="mt-1 text-[11px] italic text-stone-400">
            Chưa nhập sinh nhật
          </div>
        ) : null}
      </div>
      {canEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-[11px] text-stone-700 hover:bg-stone-50"
        >
          Sửa
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
      className="space-y-3 rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
        Sửa thông tin gia đình
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-700">
          Tên gia đình
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={120}
          className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
          disabled={saving}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-700">
          Ngày cưới
        </label>
        <input
          type="date"
          value={wedding}
          onChange={(e) => setWedding(e.target.value)}
          className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
          disabled={saving}
        />
        <p className="mt-1 text-[10px] text-stone-400">
          Để trống nếu muốn xoá.
        </p>
      </div>
      {err && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {err}
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50"
        >
          Huỷ
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:bg-stone-300"
        >
          {saving ? 'Đang lưu…' : 'Lưu'}
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
        Sửa thông tin cá nhân
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-700">
          Tên hiển thị
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={80}
          className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
          disabled={saving}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-700">
          Ngày sinh
        </label>
        <input
          type="date"
          value={birthdate}
          onChange={(e) => setBirthdate(e.target.value)}
          className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
          disabled={saving}
        />
      </div>
      {err && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {err}
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50"
        >
          Huỷ
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:bg-stone-300"
        >
          {saving ? 'Đang lưu…' : 'Lưu'}
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
