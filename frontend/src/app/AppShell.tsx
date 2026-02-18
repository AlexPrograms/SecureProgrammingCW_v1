import { NavLink, Outlet } from 'react-router-dom';

import { StatusBadge } from '../components/StatusBadge';
import { useVaultStore } from '../store/vaultStore';

const navItems = [
  { to: '/app/entries', label: 'Entries' },
  { to: '/app/import-export', label: 'Import/Export' },
  { to: '/app/settings', label: 'Settings' },
  { to: '/app/audit', label: 'Audit' }
];

export function AppShell() {
  const lockNow = useVaultStore((state) => state.lockNow);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Password Vault</h1>
            <StatusBadge />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => lockNow('MANUAL')}
              className="rounded-md border border-slate-600 px-3 py-2 text-sm font-medium hover:border-slate-400"
            >
              Lock now
            </button>
          </div>
        </div>

        <nav className="mx-auto flex max-w-6xl gap-2 px-4 pb-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
