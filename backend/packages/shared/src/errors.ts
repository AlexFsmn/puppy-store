import {Response} from 'express';
import {logger} from './observability/logger';

export type HttpStatus = 400 | 401 | 403 | 404 | 409 | 500;

export interface ErrorCode {
  status: HttpStatus;
}

export class ServiceError<T extends string = string> extends Error {
  constructor(
    public code: T,
    message: string,
    public status: HttpStatus = 500
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export function defineErrors<T extends Record<string, HttpStatus>>(codes: T) {
  return codes;
}

export function createErrorHandler<T extends Record<string, HttpStatus>>(
  errorCodes: T,
  serviceName: string
) {
  return function handleError(error: unknown, res: Response, fallbackMessage: string): boolean {
    if (error instanceof ServiceError) {
      const status = errorCodes[error.code as keyof T] ?? error.status;
      res.status(status).json({error: error.message});
      return true;
    }
    logger.error({err: error, service: serviceName}, 'Service error');
    res.status(500).json({error: fallbackMessage});
    return true;
  };
}

// Common error codes used across services
export const ErrorCode = {
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  UNAUTHORIZED: 'UNAUTHORIZED',
  BAD_REQUEST: 'BAD_REQUEST',
  CONFLICT: 'CONFLICT',
} as const;

export const CommonErrors = defineErrors({
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.BAD_REQUEST]: 400,
  [ErrorCode.CONFLICT]: 409,
} as const);

export type CommonErrorCode = keyof typeof CommonErrors;

// Common error messages for generic errors
export const ErrorMessage = {
  [ErrorCode.NOT_FOUND]: (resource?: string) => resource ? `${resource} not found` : 'Resource not found',
  [ErrorCode.FORBIDDEN]: 'Access denied',
  [ErrorCode.UNAUTHORIZED]: 'Authentication required',
  [ErrorCode.BAD_REQUEST]: 'Invalid request',
  [ErrorCode.CONFLICT]: (resource?: string) => resource ? `${resource} already exists` : 'Resource already exists',
};

/** @deprecated Use ErrorMessage instead */
export const CommonErrorMessage = ErrorMessage;
