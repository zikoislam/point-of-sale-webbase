import { backupService } from '../services/BackupService';
import { env } from '../config/env';

/**
 * Takes a full snapshot of the database and then trims the oldest automatic
 * backups so the disk cannot fill up. Manual backups are left untouched.
 */
export const runAutoBackup = async (): Promise<void> => {
  const meta = await backupService.createBackup('auto');
  const pruned = await backupService.pruneAutoBackups(env.BACKUP_RETENTION);
  console.log(
    `💾 [CRON] Auto backup created: ${meta.name} (${meta.collections} collections, ${meta.documents} documents). Pruned ${pruned} old backup(s).`
  );
};
