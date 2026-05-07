export const OPENING_BALANCE_NOTE = '__opening_balance__';

export function isOpeningBalanceNote(note: string | null | undefined): boolean {
  return note === OPENING_BALANCE_NOTE;
}
