'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  createImportantDate,
  updateImportantDate,
} from '../api';
import type {
  CreateImportantDatePayload,
  ImportantDateType,
  ImportantDateView,
} from '../types';
import { ReminderChips } from './reminder-chips';

const TYPE_OPTIONS: { value: ImportantDateType; label: string }[] = [
  { value: 'birthday', label: 'Sinh nhật' },
  { value: 'death_anniversary', label: 'Ngày giỗ' },
  { value: 'anniversary', label: 'Kỷ niệm' },
  { value: 'other', label: 'Khác' },
];

export function ImportantDateFormModal({
  open,
  entry,
  onClose,
  onSaved,
}: {
  open: boolean;
  entry: ImportantDateView | null;
  onClose: () => void;
  onSaved: (saved: ImportantDateView) => void;
}) {
  const t = useTranslations('dates');
  const tCommon = useTranslations('common');
  const TYPE_OPTIONS_I18N = [
    { value: 'birthday' as const, label: t('kind_birthday') },
    { value: 'death_anniversary' as const, label: t('kind_death_anniversary') },
    { value: 'anniversary' as const, label: t('kind_anniversary') },
    { value: 'other' as const, label: t('kind_other') },
  ];
  const [name, setName] = useState('');
  const [type, setType] = useState<ImportantDateType>('birthday');
  const [date, setDate] = useState('');
  const [isLunar, setIsLunar] = useState(false);
  const [reminders, setReminders] = useState<number[]>([0]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (entry) {
      setName(entry.name);
      setType(entry.type);
      setDate(entry.date);
      setIsLunar(entry.isLunar);
      setReminders(entry.remindDaysBefore);
      setNotes(entry.notes ?? '');
    } else {
      setName('');
      setType('birthday');
      setDate('');
      setIsLunar(false);
      setReminders([0]);
      setNotes('');
    }
    setError(null);
  }, [open, entry]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !date) {
      setError(t('form_required'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: CreateImportantDatePayload = {
        name: name.trim(),
        type,
        date,
        isLunar,
        remindDaysBefore: reminders.length > 0 ? reminders : [0],
        notes: notes.trim() || undefined,
      };
      const saved = entry
        ? await updateImportantDate(entry.id, payload)
        : await createImportantDate(payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl bg-white p-4 sm:p-6 shadow-xl"
      >
        <h2 className="mb-4 text-base font-semibold text-stone-900">
          {entry ? t('form_edit_title') : t('form_add_title')}
        </h2>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">
              {t('form_name_label')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('form_name_placeholder')}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              maxLength={120}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">
              {t('form_type_label')}
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ImportantDateType)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {TYPE_OPTIONS_I18N.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">
              {t('form_date_label')} {isLunar && <span className="text-amber-600">{t('form_date_lunar_hint')}</span>}
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={isLunar}
              onChange={(e) => setIsLunar(e.target.checked)}
              className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
            />
            {t('form_lunar_checkbox')}
          </label>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">
              {t('form_remind_label')}
            </label>
            <ReminderChips value={reminders} onChange={setReminders} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">
              {t('form_notes_label')}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={2000}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {error && (
            <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </p>
          )}
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 sm:w-auto"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 sm:w-auto"
          >
            {submitting ? tCommon('saving') : tCommon('save')}
          </button>
        </div>
      </form>
    </div>
  );
}
