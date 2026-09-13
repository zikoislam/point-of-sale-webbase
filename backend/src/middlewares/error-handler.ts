import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/app-error';
import { sendError } from '../utils/api-response';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.errorCode, err.message, err.details);
    return;
  }

  // Zod validation performed inside services (not via the validate() middleware)
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({ field: e.path.join('.'), message: e.message }));
    sendError(res, 400, 'INVALID_PAYLOAD', 'Validation failed', details);
    return;
  }

  // Duplicate key (unique index violation)
  if ((err as any).code === 11000) {
    sendError(res, 409, 'DUPLICATE_RESOURCE', 'A record with these unique values already exists');
    return;
  }

  // Handle Mongoose CastError (e.g. invalid ObjectId)
  if (err.name === 'CastError') {
    sendError(res, 400, 'INVALID_ID_FORMAT', 'Provided ID format is invalid');
    return;
  }

  // Handle Mongoose ValidationError
  if (err.name === 'ValidationError') {
    sendError(res, 400, 'VALIDATION_ERROR', err.message);
    return;
  }

  // Unhandled / Internal Server Error
  console.error('Unhandled Exception:', err);
  sendError(
    res,
    500,
    'INTERNAL_SERVER_ERROR',
    process.env.NODE_ENV === 'production'
      ? 'An internal server error occurred'
      : err.message
  );
};
