import { Request, Response, NextFunction } from 'express';
import { backupService } from '../services/BackupService';
import { auditService } from '../services/AuditService';
import { sendSuccess } from '../utils/api-response';
import { AppError } from '../utils/app-error';

class BackupController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const backups = await backupService.listBackups();
      sendSuccess(res, 200, 'Backups retrieved', backups);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const meta = await backupService.createBackup('manual');

      if (req.user) {
        await auditService
          .logAction(
            req.user.userId,
            'CREATE',
            'backups',
            meta.name,
            {
              trigger: 'manual',
              documents: meta.documents,
              collections: meta.collections,
              size: meta.size,
            },
            req.ip
          )
          .catch(() => undefined);
      }

      sendSuccess(res, 201, 'Backup created successfully', meta);
    } catch (error) {
      next(error);
    }
  }

  async restore(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await backupService.restoreBackup(req.params.name);

      if (req.user) {
        await auditService
          .logAction(
            req.user.userId,
            'UPDATE',
            'backups',
            result.restoredFrom,
            {
              action: 'RESTORE',
              restoredFrom: result.restoredFrom,
              safetyBackup: result.safetyBackup,
              collections: result.collections,
              documents: result.documents,
              inserted: result.inserted,
              updated: result.updated,
              skipped: result.skipped,
            },
            req.ip
          )
          .catch(() => undefined);
      }

      sendSuccess(res, 200, 'Database restored successfully', result);
    } catch (error) {
      next(error);
    }
  }

  /** Restore from a snapshot the admin uploaded from their own machine. */
  async restoreUpload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new AppError(400, 'NO_FILE', 'No backup file was uploaded');
      }

      const result = await backupService.restoreFromUpload(req.file.buffer, req.file.originalname);

      if (req.user) {
        await auditService
          .logAction(
            req.user.userId,
            'UPDATE',
            'backups',
            result.restoredFrom,
            {
              action: 'RESTORE_FROM_UPLOAD',
              safetyBackup: result.safetyBackup,
              collections: result.collections,
              documents: result.documents,
              inserted: result.inserted,
              updated: result.updated,
              skipped: result.skipped,
            },
            req.ip
          )
          .catch(() => undefined);
      }

      sendSuccess(res, 200, 'Database restored successfully', result);
    } catch (error) {
      next(error);
    }
  }

  async download(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { abs, name } = backupService.getBackupFile(req.params.name);
      res.download(abs, name, (err) => {
        if (err && !res.headersSent) next(err);
      });
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await backupService.deleteBackup(req.params.name);
      sendSuccess(res, 200, 'Backup deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const backupController = new BackupController();
