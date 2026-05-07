'use client';

import { useEffect, useState } from 'react';
import {
  ApiError,
  formatVND,
  getSalaryRule,
  listGoals,
  setFundOpeningBalance,
  updateSalaryRule,
  updateYearlySavingsGoal,
  type FundView,
  type GoalView,
  type SalaryRule,
} from '../../../lib/api';
import { pickFundIcon, useAuthedLayout } from '../layout';
import { ChangePasswordModal } from '../_components/change-password-modal';
import {
  Card,
  PageHeader,
  Skeleton,
} from '../_components/ui';

export default function SettingsPage() {
  const { user } = useAuthedLayout();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Cài đặt"
        subtitle="Tài khoản, mật khẩu và quy tắc lương"
      />
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <AccountSection />
          <YearlyGoalSection />
          <OpeningBalanceSection />
          <SalarySplitSection />
          <DangerZoneSection />
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
  const { user } = useAuthedLayout();
  const [pwOpen, setPwOpen] = useState(false);

  return (
    <Card padding="p-6">
      <h3 className="mb-1 text-sm font-semibold text-stone-800">
        Tài khoản
      </h3>
      <p className="mb-5 text-xs text-stone-500">
        Concord là couple-only — không có signup public, mỗi instance chỉ
        có 2 tài khoản (vợ + chồng).
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Tên" value={user.name} />
        <Field
          label="Vai trò"
          value={user.role === 'husband' ? 'Chồng' : 'Vợ'}
        />
        <Field label="Email" value={user.email} mono />
        <Field label="ID" value={user.id} mono small />
      </div>

      <div className="mt-5 flex justify-end border-t border-stone-100 pt-4">
        <button
          onClick={() => setPwOpen(true)}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-800 active:scale-[0.99]"
        >
          🔐 Đổi mật khẩu
        </button>
      </div>

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

// ─── Yearly savings goal section ───────────────────────────────────────

function YearlyGoalSection() {
  const [goal, setGoal] = useState<GoalView | null>(null);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: 'ok' | 'err';
    msg: string;
  } | null>(null);

  useEffect(() => {
    listGoals()
      .then((gs) => {
        const yearly = gs.find((g) => g.period === 'year' && g.type === 'save');
        if (yearly) {
          setGoal(yearly);
          setTarget(yearly.targetAmount);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const year = new Date().getFullYear();
  const isDirty =
    target !== '' && Number(target) > 0 && Number(target) !== goal?.targetAmount;

  async function onSave() {
    if (target === '' || Number(target) <= 0) return;
    setSaving(true);
    setFeedback(null);
    try {
      const updated = await updateYearlySavingsGoal(Number(target));
      setGoal(updated);
      setFeedback({ kind: 'ok', msg: 'Đã lưu mục tiêu' });
      setTimeout(() => setFeedback(null), 2500);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Lỗi không xác định';
      setFeedback({ kind: 'err', msg });
    } finally {
      setSaving(false);
    }
  }

  const presets = [100_000_000, 150_000_000, 200_000_000];

  return (
    <Card padding="p-6">
      <h3 className="mb-1 text-sm font-semibold text-stone-800">
        Mục tiêu tiết kiệm năm {year}
      </h3>
      <p className="mb-5 text-xs text-stone-500">
        Số tiền 2 vợ chồng muốn để dành cùng nhau trong năm. Tiến độ trên
        dashboard tính bằng <span className="font-medium">tổng thu − tổng chi</span>{' '}
        của cả 3 quỹ (đã loại &ldquo;Chuyển nội bộ&rdquo;).
      </p>

      {loading && <Skeleton className="h-32 w-full rounded-lg" />}

      {!loading && (
        <>
          <label className="mb-1.5 block text-xs font-medium text-stone-700">
            Mục tiêu (VND)
          </label>
          <input
            type="number"
            value={target}
            onChange={(e) =>
              setTarget(e.target.value === '' ? '' : Number(e.target.value))
            }
            placeholder="vd: 150000000 (150 triệu)"
            className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm transition-colors focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
          <p className="mt-1 text-[11px] text-stone-400">
            {target !== '' && Number(target) > 0 ? (
              <>
                Hiển thị:{' '}
                <span className="font-mono">{formatVND(Number(target))}</span>
              </>
            ) : (
              'Nhập số nguyên VND, vd: 150000000.'
            )}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setTarget(p)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  target === p
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                }`}
              >
                {formatVND(p)}
              </button>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-stone-100 pt-4">
            {feedback && (
              <span
                className={`text-xs ${
                  feedback.kind === 'ok' ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {feedback.kind === 'ok' ? '✅' : '⚠️'} {feedback.msg}
              </span>
            )}
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => {
                  setTarget(goal?.targetAmount ?? '');
                  setFeedback(null);
                }}
                disabled={saving || !goal}
                className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700 transition-colors hover:bg-stone-50 disabled:opacity-50"
              >
                Reset
              </button>
              <button
                onClick={onSave}
                disabled={saving || !isDirty}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-800 active:scale-[0.99] disabled:bg-stone-300"
              >
                {saving ? 'Đang lưu…' : 'Lưu'}
              </button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

// ─── Opening balance section ───────────────────────────────────────────

function OpeningBalanceSection() {
  const { funds, reloadFunds } = useAuthedLayout();
  const accessible = funds.filter((f) => f.accessLevel !== 'private');

  return (
    <Card padding="p-6">
      <h3 className="mb-1 text-sm font-semibold text-stone-800">
        Số dư khởi đầu
      </h3>
      <p className="mb-5 text-xs text-stone-500">
        Tiền đã có sẵn trong mỗi quỹ tại thời điểm bạn bắt đầu xài Concord
        (vd: số dư app ngân hàng, ví Shopee, tiền mặt). Khoản này được ghi như
        1 entry cấu trúc — không hiện trong &ldquo;Giao dịch gần đây&rdquo; và không tính
        vào báo cáo thu/chi tháng. Riêng <span className="font-medium">Quỹ Chung</span>{' '}
        sẽ cộng vào tiến độ tiết kiệm năm.
      </p>

      {accessible.length === 0 && (
        <Skeleton className="h-24 w-full rounded-lg" />
      )}

      <div className="space-y-3">
        {accessible
          .filter((f) => f.purpose === 'general')
          .map((fund) => (
            <OpeningBalanceRow
              key={fund.id}
              fund={fund}
              onSaved={() => void reloadFunds()}
            />
          ))}
      </div>
    </Card>
  );
}

function OpeningBalanceRow({
  fund,
  onSaved,
}: {
  fund: FundView;
  onSaved: () => void;
}) {
  const initial = fund.openingBalance ?? 0;
  const [value, setValue] = useState<number | ''>(initial);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: 'ok' | 'err';
    msg: string;
  } | null>(null);

  useEffect(() => {
    setValue(fund.openingBalance ?? 0);
  }, [fund.openingBalance]);

  const isDirty = value !== '' && Number(value) !== initial;
  const isJoint = fund.type === 'joint';

  async function onSave() {
    if (value === '' || Number(value) < 0) return;
    setSaving(true);
    setFeedback(null);
    try {
      await setFundOpeningBalance(fund.id, Number(value));
      setFeedback({ kind: 'ok', msg: 'Đã lưu' });
      onSaved();
      setTimeout(() => setFeedback(null), 2500);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Lỗi không xác định';
      setFeedback({ kind: 'err', msg });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        isJoint
          ? 'border-amber-100 bg-amber-50/40'
          : 'border-emerald-100 bg-emerald-50/30'
      }`}
    >
      <div className="mb-2 flex items-baseline justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium text-stone-800">
          <span>{pickFundIcon(fund)}</span> {fund.name}
        </span>
        <span className="text-[11px] text-stone-500">
          Số dư hiện tại:{' '}
          <span className="font-mono">{formatVND(fund.balance ?? 0)}</span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) =>
            setValue(e.target.value === '' ? '' : Number(e.target.value))
          }
          placeholder="0"
          className="min-w-0 flex-1 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        />
        <span className="font-mono text-xs tabular-nums text-stone-500">
          {value !== '' && Number(value) >= 0 ? formatVND(Number(value)) : '—'}
        </span>
        <button
          onClick={onSave}
          disabled={saving || !isDirty}
          className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-medium text-white transition-all hover:bg-emerald-800 active:scale-[0.99] disabled:bg-stone-300"
        >
          {saving ? 'Đang lưu…' : 'Lưu'}
        </button>
      </div>
      {feedback && (
        <div
          className={`mt-2 text-[11px] ${
            feedback.kind === 'ok' ? 'text-emerald-700' : 'text-rose-700'
          }`}
        >
          {feedback.kind === 'ok' ? '✅' : '⚠️'} {feedback.msg}
        </div>
      )}
    </div>
  );
}

// ─── Salary split section ──────────────────────────────────────────────

function SalarySplitSection() {
  const [rule, setRule] = useState<SalaryRule | null>(null);
  const [loading, setLoading] = useState(true);
  const [pctPersonal, setPctPersonal] = useState(70);
  const [fixedJoint, setFixedJoint] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: 'ok' | 'err';
    msg: string;
  } | null>(null);

  useEffect(() => {
    getSalaryRule()
      .then((r) => {
        setRule(r);
        setPctPersonal(r.pctToPersonal);
        setFixedJoint(r.fixedAmountToJoint ?? '');
      })
      .catch(() => {
        /* ignore */
      })
      .finally(() => setLoading(false));
  }, []);

  const pctJoint = 100 - pctPersonal;

  async function onSave() {
    setSaving(true);
    setFeedback(null);
    try {
      const updated = await updateSalaryRule(
        pctPersonal,
        pctJoint,
        fixedJoint === '' ? null : Number(fixedJoint),
      );
      setRule(updated);
      setFeedback({ kind: 'ok', msg: 'Đã lưu' });
      setTimeout(() => setFeedback(null), 2500);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Lỗi không xác định';
      setFeedback({ kind: 'err', msg });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card padding="p-6">
      <h3 className="mb-1 text-sm font-semibold text-stone-800">
        Quy tắc phân bổ lương
      </h3>
      <p className="mb-5 text-xs text-stone-500">
        Khi lương về (cron tự động vào ngày trả lương), agent sẽ alloc theo
        tỉ lệ này vào quỹ riêng + quỹ chung.
      </p>

      {loading && <Skeleton className="h-32 w-full rounded-lg" />}

      {!loading && rule && (
        <>
          <div className="mb-6">
            <div className="mb-2 flex items-baseline justify-between text-sm">
              <span className="text-stone-700">
                Quỹ riêng:{' '}
                <span className="font-mono font-semibold tabular-nums text-emerald-700">
                  {pctPersonal}%
                </span>
              </span>
              <span className="text-stone-700">
                Quỹ chung:{' '}
                <span className="font-mono font-semibold tabular-nums text-amber-700">
                  {pctJoint}%
                </span>
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={pctPersonal}
              onChange={(e) => setPctPersonal(Number(e.target.value))}
              className="w-full accent-emerald-600"
            />
            <div className="mt-1 flex justify-between text-[10px] text-stone-400">
              <span>0% riêng / 100% chung</span>
              <span>50/50</span>
              <span>100% riêng / 0% chung</span>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-stone-700">
              Số cố định vào quỹ chung (tuỳ chọn)
            </label>
            <input
              type="number"
              value={fixedJoint}
              onChange={(e) =>
                setFixedJoint(e.target.value === '' ? '' : Number(e.target.value))
              }
              placeholder="vd: 5000000 (5 triệu)"
              className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-sm transition-colors focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
            <p className="mt-1 text-[11px] text-stone-400">
              Nếu set: mỗi tháng sẽ trừ số này vào quỹ chung TRƯỚC, phần còn
              lại mới chia theo % ở trên.
              {fixedJoint !== '' && Number(fixedJoint) > 0 && (
                <>
                  {' '}
                  Hiện set:{' '}
                  <span className="font-mono">
                    {formatVND(Number(fixedJoint))}
                  </span>
                  /tháng vào quỹ chung.
                </>
              )}
            </p>
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-stone-100 pt-4">
            {feedback && (
              <span
                className={`text-xs ${
                  feedback.kind === 'ok' ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {feedback.kind === 'ok' ? '✅' : '⚠️'} {feedback.msg}
              </span>
            )}
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => {
                  setPctPersonal(rule.pctToPersonal);
                  setFixedJoint(rule.fixedAmountToJoint ?? '');
                  setFeedback(null);
                }}
                disabled={saving}
                className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700 transition-colors hover:bg-stone-50"
              >
                Reset
              </button>
              <button
                onClick={onSave}
                disabled={saving}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-800 active:scale-[0.99] disabled:bg-stone-300"
              >
                {saving ? 'Đang lưu…' : 'Lưu'}
              </button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

// ─── Danger zone ───────────────────────────────────────────────────────

function DangerZoneSection() {
  return (
    <Card padding="p-6" className="border border-rose-100">
      <h3 className="mb-1 text-sm font-semibold text-rose-700">Vùng nguy hiểm</h3>
      <p className="mb-4 text-xs text-stone-500">
        Các thao tác không thể hoàn tác. Sẽ implement trong các tuần sau.
      </p>
      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
          <div>
            <div className="text-sm font-medium text-stone-700">
              Xoá tất cả giao dịch
            </div>
            <div className="text-[11px] text-stone-500">
              Reset balance về 0, không xoá quỹ + categories.
            </div>
          </div>
          <button
            disabled
            className="cursor-not-allowed rounded-lg bg-stone-200 px-3 py-1.5 text-xs text-stone-500"
          >
            Soon
          </button>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
          <div>
            <div className="text-sm font-medium text-stone-700">
              Export toàn bộ dữ liệu (CSV)
            </div>
            <div className="text-[11px] text-stone-500">
              Tải về CSV transactions của bạn (privacy-respecting).
            </div>
          </div>
          <button
            disabled
            className="cursor-not-allowed rounded-lg bg-stone-200 px-3 py-1.5 text-xs text-stone-500"
          >
            Soon
          </button>
        </div>
      </div>
    </Card>
  );
}
