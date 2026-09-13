'use client';

import React from 'react';
import { ProtectedRoute } from '../../components/ProtectedRoute';

export default function POSLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute requiredPermission="pos:checkout">{children}</ProtectedRoute>;
}
