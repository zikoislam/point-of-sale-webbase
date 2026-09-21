'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Database,
  Download,
  Trash2,
  RefreshCw,
  Plus,
  ShieldCheck,
  Clock,
  HardDrive,
  Info,
} from 'lucide-react';
import { api } from '../../../lib/api-client';
import { API_BASE_URL } from '../../../lib/constants';
import { Button, ConfirmDialog, useToast } from '../../../components/ui';

interface BackupMeta {
  name: string;
  trigger: 'manual' | 'auto';
  takenAt: string;
  database: string;
  collections: number;
  documents: number;
  size: number;
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function BackupPage() {
  const toast = useToast();
  const [backups, setBackups] = useState<BackupMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BackupMeta | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<BackupMeta[]>('/backups');
      setBackups(res.data || []);
    } catch (err: any) {
      toast.error(err?.message || 'Could not load backups');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchBackups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await api.post<BackupMeta>('/backups');
      const meta = res.data;
      toast.success(
        `Backup created — ${meta?.documents ?? 0} documents from ${meta?.collections ?? 0} collections`,
        'Backup ready'
      );
      await fetchBackups();
    } catch (err: any) {
      toast.error(err?.message || 'Backup failed');
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async (backup: BackupMeta) => {
    setDownloading(backup.name);
    try {
      const token = typeof window !== 'undefined' ? sessionStorage.getItem('pos_token') : null;
      const res = await fetch(`${API_BASE_URL}/backups/${encodeURIComponent(backup.name)}/download`, {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error('Download failed. Please try again.');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backup.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`${backup.name} downloaded`, 'Saved to your device');
    } catch (err: any) {
      toast.error(err?.message || 'Download failed');
    } finally {
      setDownloading(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/backups/${encodeURIComponent(deleteTarget.name)}`);
      toast.success('Backup deleted');
      setDeleteTarget(null);
      await fetchBackups();
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Database Backup</h1>
            <p className="text-sm text-slate-400">
              Take a manual snapshot any time, or download an existing one — an automatic backup also runs every day.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="secondary"
            onClick={fetchBackups}
            disabled={loading}
            leftIcon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
          <Button
            onClick={handleCreate}
            loading={creating}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Create Backup Now
          </Button>
        </div>
      </div>

      {/* Automatic backup info */}
      <div className="flex items-start gap-3 bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div className="text-xs text-slate-400 leading-relaxed">
          <p className="text-slate-200 font-semibold text-sm mb-0.5">Automatic daily backup is active</p>
          A full snapshot is taken every day at <span className="text-slate-200">02:00 AM</span> and the newest 7
          automatic backups are kept (older ones are removed automatically). Manual backups are never
          removed automatically — download them to keep an off-server copy.
        </div>
      </div>

      {/* Backups table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-800">
          <HardDrive className="w-4 h-4 text-indigo-400" />
          <h2 className="text-sm font-semibold text-slate-100">Available Backups</h2>
          {!loading && (
            <span className="ml-auto text-xs text-slate-500">{backups.length} file(s)</span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 uppercase font-semibold text-slate-400">
                <th className="py-3 px-4">Taken At</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Collections</th>
                <th className="py-3 px-4">Documents</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-400" />
                    Loading backups...
                  </td>
                </tr>
              ) : backups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <Info className="w-6 h-6 mx-auto mb-2 text-slate-600" />
                    No backups yet. Click &quot;Create Backup Now&quot; to take your first snapshot.
                  </td>
                </tr>
              ) : (
                backups.map((b) => (
                  <tr key={b.name} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {formatDateTime(b.takenAt)}
                      </span>
                      <div className="text-[10px] text-slate-600 font-mono mt-0.5 truncate max-w-[240px]">
                        {b.name}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          b.trigger === 'auto'
                            ? 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                            : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                        }`}
                      >
                        {b.trigger === 'auto' ? 'AUTO' : 'MANUAL'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300">{b.collections}</td>
                    <td className="py-3 px-4 text-slate-300">{b.documents}</td>
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap">{formatBytes(b.size)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleDownload(b)}
                          disabled={downloading === b.name}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 font-semibold disabled:opacity-50 transition"
                          title="Download"
                        >
                          {downloading === b.name ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          Download
                        </button>
                        <button
                          onClick={() => setDeleteTarget(b)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-semibold transition"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete this backup?"
        confirmText="Delete"
        description={
          <>
            <span className="font-mono text-slate-300 break-all">{deleteTarget?.name}</span> will be permanently
            removed from the server. Make sure you have downloaded a copy if you may need it.
          </>
        }
      />
    </div>
  );
}
