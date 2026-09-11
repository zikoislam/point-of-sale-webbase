import React from 'react';
import { Spinner } from '../components/ui/Spinner';

export default function GlobalLoading() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100">
      <div className="flex flex-col items-center gap-4 bg-slate-900/60 border border-slate-800/80 p-8 rounded-2xl shadow-xl backdrop-blur-sm">
        <Spinner size="lg" color="primary" />
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-200">Loading Smart Retail POS...</p>
          <p className="text-xs text-slate-500 mt-1">Preparing workspace and syncing cache</p>
        </div>
      </div>
    </div>
  );
}
