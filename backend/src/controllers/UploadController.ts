import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { sendSuccess } from '../utils/api-response';
import { AppError } from '../utils/app-error';

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

class UploadController {
  async uploadImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new AppError(400, 'NO_FILE', 'No image file was uploaded');
      }

      const ext = MIME_EXT[req.file.mimetype] || 'png';
      const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
      const uploadsDir = path.resolve(__dirname, '../../uploads');

      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      fs.writeFileSync(path.join(uploadsDir, filename), req.file.buffer);

      const url = `${req.protocol}://${req.get('host')}/uploads/${filename}`;
      sendSuccess(res, 201, 'Image uploaded successfully', { url, filename });
    } catch (err) {
      next(err);
    }
  }
}

export const uploadController = new UploadController();
