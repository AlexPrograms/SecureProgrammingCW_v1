import { Copy, KeyRound, Plus, Star } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { copyToClipboard } from '../../services/clipboardService';
import { useUIStore } from '../../store/uiStore';
import { useVaultStore } from '../../store/vaultStore';
import type { Entry } from '../../types/models';
import { ReauthCopyDialog } from './ReauthCopyDialog';

export function DashboardPage() {
  const entries = useVaultStore((state) => state.entries);
  const refreshEntries = useVaultStore((state) => state.refreshEntries);
  const settings = useVaultStore((state) => state.settings);
  const verifyForCopy = useVaultStore((state) => state.verifyForCopy);

  const addToast = useUIStore((state) => state.addToast);
  const startClipboardCountdown = useUIStore((state) => state.startClipboardCountdown);

  const [query, setQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [pendingCopyEntry, setPendingCopyEntry] = useState<Entry | null>(null);

  useEffect(() => {
    refreshEntries();
  }, [refreshEntries]);

  const filteredEntries = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return entries.filter((entry) => {
      if (favoritesOnly && !entry.favorite) {
        return false;
      }

      if (!needle) {
        return true;
      }

      const haystack = [entry.title, entry.username, entry.url ?? '', entry.tags.join(' ')].join(' ').toLowerCase();
      return haystack.includes(needle);
    });
  }, [entries, favoritesOnly, query]);

  const copyPassword = async (password: string): Promise<void> => {
    const ok = await copyToClipboard(password);
    if (!ok) {
      addToast('Copy failed.', 'error');
      return;
    }

    startClipboardCountdown(settings.clipboardClearSeconds);
  };

  const handleCopyUsername = async (username: string): Promise<void> => {
    const ok = await copyToClipboard(username);
    if (!ok) {
      addToast('Copy failed.', 'error');
      return;
    }

    addToast('Username copied.', 'success');
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Entries</h2>
        <Link
          to="/app/entries/new"
          className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500"
        >
          <Plus size={16} />
          Add Entry
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 rounded-lg border border-slate-800 bg-slate-900/70 p-3">
        <input
          type="search"
          placeholder="Search title, username, URL, tags..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-w-[18rem] flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          aria-label="Search entries"
        />

        <label className="inline-flex items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-sm">
          <input type="checkbox" checked={favoritesOnly} onChange={(event) => setFavoritesOnly(event.target.checked)} />
          Favorites only
        </label>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
          <thead className="bg-slate-900">
            <tr>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Username</th>
              <th className="px-3 py-2">Updated</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/40">
            {filteredEntries.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-slate-400" colSpan={4}>
                  No entries found.
                </td>
              </tr>
            ) : null}

            {filteredEntries.map((entry) => (
              <tr key={entry.id}>
                <td className="px-3 py-3">
                  <Link to={`/app/entries/${entry.id}`} className="font-medium text-sky-300 hover:underline">
                    {entry.title}
                  </Link>
                  {entry.favorite ? <Star size={14} className="ml-2 inline text-amber-300" /> : null}
                </td>
                <td className="px-3 py-3 text-slate-300">{entry.username}</td>
                <td className="px-3 py-3 text-slate-400">{new Date(entry.updatedAt).toLocaleString()}</td>
                <td className="px-3 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void handleCopyUsername(entry.username);
                      }}
                      className="rounded-md border border-slate-700 p-2 hover:border-slate-500"
                      aria-label="Copy username"
                    >
                      <Copy size={15} />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (settings.requireReauthForCopy) {
                          setPendingCopyEntry(entry);
                          return;
                        }

                        void copyPassword(entry.password);
                      }}
                      className="rounded-md border border-slate-700 p-2 hover:border-slate-500"
                      aria-label="Copy password"
                    >
                      <KeyRound size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ReauthCopyDialog
        open={Boolean(pendingCopyEntry)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingCopyEntry(null);
          }
        }}
        onConfirm={async (masterPassword) => {
          const verified = await verifyForCopy(masterPassword);
          if (!verified || !pendingCopyEntry) {
            return false;
          }

          await copyPassword(pendingCopyEntry.password);
          setPendingCopyEntry(null);
          return true;
        }}
      />
    </section>
  );
}
