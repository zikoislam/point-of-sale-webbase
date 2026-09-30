'use client';

import React, { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/query-client';
import { AuthProvider } from '../lib/auth-context';
import { ToastProvider } from './ui/Toast';
import { I18nProvider } from '../lib/i18n';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => queryClient);

  return (
    <I18nProvider>
      <QueryClientProvider client={client}>
        <AuthProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
}
