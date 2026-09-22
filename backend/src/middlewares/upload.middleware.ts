import multer from 'multer';
import { AppError } from '../utils/app-error';

const ALLOWED_MIME = /^image\/(png|jpe?g|webp|gif)$/;

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(400, 'INVALID_FILE_TYPE', 'Only PNG, JPG, WEBP or GIF images are allowed'));
    }
  },
});

/**
 * A database snapshot picked from the admin's own machine. Browsers report the
 * type inconsistently for .json files, so the extension is accepted too.
 */
export const backupUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB — a full snapshot can be large
  fileFilter: (req, file, cb) => {
    const looksLikeJson = /\.json$/i.test(file.originalname) || /json/i.test(file.mimetype);
    if (looksLikeJson) {
      cb(null, true);
    } else {
      cb(new AppError(400, 'INVALID_FILE_TYPE', 'Only a .json database backup can be restored'));
    }
  },
});
