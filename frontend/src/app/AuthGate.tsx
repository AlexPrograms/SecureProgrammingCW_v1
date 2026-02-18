import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { useVaultStore } from '../store/vaultStore';

type RequiredStatus = 'NO_VAULT' | 'LOCKED' | 'UNLOCKED';

interface AuthGateProps {
  requireStatus: RequiredStatus;
  children: ReactNode;
}

const redirectForStatus = (status: RequiredStatus): string => {
  if (status === 'NO_VAULT') {
    return '/setup';
  }

  if (status === 'LOCKED') {
    return '/unlock';
  }

  return '/app/entries';
};

export function AuthGate({ requireStatus, children }: AuthGateProps) {
  const vaultStatus = useVaultStore((state) => state.vaultStatus);

  if (vaultStatus !== requireStatus) {
    return <Navigate to={redirectForStatus(vaultStatus)} replace />;
  }

  return <>{children}</>;
}
