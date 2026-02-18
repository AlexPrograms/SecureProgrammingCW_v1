import { Navigate, Route, Routes } from 'react-router-dom';
import { useEffect, useRef } from 'react';

import { AppShell } from './AppShell';
import { AuthGate } from './AuthGate';
import { ClipboardManager } from '../components/ClipboardManager';
import { ToastStack } from '../components/ToastStack';
import { AuditPage } from '../features/audit/AuditPage';
import { SetupPage } from '../features/auth/SetupPage';
import { UnlockPage } from '../features/auth/UnlockPage';
import { DashboardPage } from '../features/entries/DashboardPage';
import { EntryDetailPage } from '../features/entries/EntryDetailPage';
import { EntryEditorPage } from '../features/entries/EntryEditorPage';
import { ImportExportPage } from '../features/importExport/ImportExportPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { useIdleLock } from '../hooks/useIdleLock';
import { useVaultStore } from '../store/vaultStore';

function RootRedirect() {
  const vaultStatus = useVaultStore((state) => state.vaultStatus);

  if (vaultStatus === 'NO_VAULT') {
    return <Navigate to="/setup" replace />;
  }

  if (vaultStatus === 'LOCKED') {
    return <Navigate to="/unlock" replace />;
  }

  return <Navigate to="/app/entries" replace />;
}

function NotFoundRedirect() {
  return <RootRedirect />;
}

function App() {
  const hydrateFromServer = useVaultStore((state) => state.hydrateFromServer);
  const isHydrating = useVaultStore((state) => state.isHydrating);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (hydratedRef.current) {
      return;
    }

    hydratedRef.current = true;
    void hydrateFromServer();
  }, [hydrateFromServer]);

  useIdleLock();

  if (isHydrating) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        <p className="text-sm">Loading vault status...</p>
      </main>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<RootRedirect />} />

        <Route
          path="/setup"
          element={
            <AuthGate requireStatus="NO_VAULT">
              <SetupPage />
            </AuthGate>
          }
        />

        <Route
          path="/unlock"
          element={
            <AuthGate requireStatus="LOCKED">
              <UnlockPage />
            </AuthGate>
          }
        />

        <Route
          path="/app"
          element={
            <AuthGate requireStatus="UNLOCKED">
              <AppShell />
            </AuthGate>
          }
        >
          <Route index element={<Navigate to="entries" replace />} />
          <Route path="entries" element={<DashboardPage />} />
          <Route path="entries/new" element={<EntryEditorPage mode="create" />} />
          <Route path="entries/:id" element={<EntryDetailPage />} />
          <Route path="entries/:id/edit" element={<EntryEditorPage mode="edit" />} />
          <Route path="import-export" element={<ImportExportPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="audit" element={<AuditPage />} />
        </Route>

        <Route path="*" element={<NotFoundRedirect />} />
      </Routes>

      <ToastStack />
      <ClipboardManager />
    </>
  );
}

export default App;
