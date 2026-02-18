import { useVaultStore } from '../store/vaultStore';

const stylesByStatus: Record<string, string> = {
  NO_VAULT: 'bg-slate-700 text-slate-100',
  LOCKED: 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-300/30',
  UNLOCKED: 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-300/30'
};

export function StatusBadge() {
  const vaultStatus = useVaultStore((state) => state.vaultStatus);

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${stylesByStatus[vaultStatus]}`}>
      {vaultStatus}
    </span>
  );
}
