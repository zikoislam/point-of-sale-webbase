import { Request, Response, NextFunction } from 'express';
import zlib from 'zlib';

/**
 * Response compression without an extra dependency.
 *
 * Only JSON / text bodies above `threshold` bytes are gzipped, and only when
 * the client asked for it — report payloads are the big win here (they can be
 * several hundred KB of JSON).
 */
const COMPRESSIBLE = /^(application\/json|text\/|application\/javascript|application\/xml|image\/svg)/i;

export function compressionMiddleware(threshold = 1024) {
  return function compression(req: Request, res: Response, next: NextFunction): void {
    const accept = String(req.headers['accept-encoding'] || '');
    if (!accept.includes('gzip') || req.method === 'HEAD') return next();

    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    const maybeCompress = (body: any): boolean => {
      if (res.getHeader('Content-Encoding')) return false; // already encoded
      const type = String(res.getHeader('Content-Type') || '');
      if (type && !COMPRESSIBLE.test(type)) return false;

      const isString = typeof body === 'string';
      const raw = isString ? Buffer.from(body) : Buffer.from(JSON.stringify(body));
      if (raw.length < threshold) return false;

      const gz = zlib.gzipSync(raw, { level: zlib.constants.Z_BEST_SPEED });

      // Express sets Content-Type from the body it is handed, so a Buffer would
      // come back as application/octet-stream and the browser/API client would
      // treat a JSON payload as an opaque file. Pin the type explicitly.
      if (!res.getHeader('Content-Type')) {
        res.setHeader('Content-Type', isString ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8');
      }
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Content-Length', String(gz.length));
      res.setHeader('Vary', 'Accept-Encoding');
      // Compression actually saved bytes worth reporting in the perf log
      (req as any).__compressed = raw.length - gz.length;
      originalSend(gz);
      return true;
    };

    res.json = function json(body: any) {
      if (maybeCompress(body)) return res as any;
      return originalJson(body);
    } as any;

    res.send = function send(body: any) {
      if (typeof body === 'object' && body !== null && !Buffer.isBuffer(body)) {
        if (maybeCompress(body)) return res as any;
      } else if (typeof body === 'string') {
        if (maybeCompress(body)) return res as any;
      }
      return originalSend(body);
    } as any;

    next();
  };
}
