import type { Guest } from '../types/types';

/**
 * Show a confirmation dialog for approve action and run the provided async handler if confirmed.
 * The handler should perform the actual approve API call / state updates.
 */
export async function confirmApproveDialog(
  g: Guest | null | undefined,
  handler: () => Promise<void>
): Promise<void> {
  if (!g) return;
  const ok = window.confirm(`${g.guestName} を承認します。よろしいですか？`);
  if (!ok) return;
  await handler();
}

/**
 * Show a confirmation dialog for reject action and run the provided async handler if confirmed.
 */
export async function confirmRejectDialog(
  g: Guest | null | undefined,
  handler: () => Promise<void>
): Promise<void> {
  if (!g) return;
  const ok = window.confirm(`${g.guestName} を拒否します。よろしいですか？`);
  if (!ok) return;
  await handler();
}

export default {
  confirmApproveDialog,
  confirmRejectDialog
};
