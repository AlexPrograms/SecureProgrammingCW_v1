import { useEffect } from 'react';

import { useVaultStore } from '../../store/vaultStore';

export function AuditPage() {
  const audit = useVaultStore((state) => state.audit);
  const refreshAudit = useVaultStore((state) => state.refreshAudit);

  useEffect(() => {
    refreshAudit();
  }, [refreshAudit]);

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Audit log</h2>
      <p className="text-sm text-slate-300">Event metadata is sanitized and never includes secrets.</p>

      <div className="overflow-hidden rounded-lg border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
          <thead className="bg-slate-900">
            <tr>
              <th className="px-3 py-2">Timestamp</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Outcome</th>
              <th className="px-3 py-2">Meta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/40">
            {audit.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-slate-400" colSpan={4}>
                  No events yet.
                </td>
              </tr>
            ) : null}

            {audit.map((event) => (
              <tr key={event.id}>
                <td className="px-3 py-3 text-slate-300">{new Date(event.ts).toLocaleString()}</td>
                <td className="px-3 py-3">{event.type}</td>
                <td className="px-3 py-3">{event.outcome}</td>
                <td className="px-3 py-3 text-xs text-slate-400">
                  {event.meta ? JSON.stringify(event.meta) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
