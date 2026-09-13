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
