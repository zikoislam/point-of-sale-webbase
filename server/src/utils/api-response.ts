import { Response } from 'express';

export interface PaginationMeta {
  page?: number;
  limit?: number;
  totalItems?: number;
  totalPages?: number;
  [key: string]: any;
}

export const sendSuccess = <T = any>(
  res: Response,
  statusCode: number = 200,
  message: string = 'Operation completed successfully',
  data?: T,
  meta?: PaginationMeta
): Response => {
  return res.status(statusCode).json({
    success: true,
    statusCode,
    message,
    ...(data !== undefined && { data }),
    ...(meta !== undefined && { meta }),
    timestamp: new Date().toISOString(),
  });
};

export const sendError = (
  res: Response,
  statusCode: number = 500,
  errorCode: string = 'INTERNAL_SERVER_ERROR',
  message: string = 'An unexpected error occurred',
  details: any[] = []
): Response => {
  return res.status(statusCode).json({
    success: false,
    statusCode,
    error: {
      code: errorCode,
      message,
      details,
    },
    timestamp: new Date().toISOString(),
  });
};
