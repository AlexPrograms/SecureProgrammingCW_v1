import type { ReactNode } from 'react';

import { StatusBadge } from '../../components/StatusBadge';

interface AuthCardLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function AuthCardLayout({ title, subtitle, children }: AuthCardLayoutProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8 text-slate-100">
      <section className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">{title}</h1>
          <StatusBadge />
        </div>
        <p className="mb-6 text-sm text-slate-300">{subtitle}</p>
        {children}
      </section>
    </main>
  );
}
