import {
  ServiceError,
  CommonErrors,
  CommonErrorCode,
  createErrorHandler,
} from '@puppy-store/shared';

// Expert service uses common errors (NOT_FOUND, BAD_REQUEST, etc.)
export const ExpertErrors = CommonErrors;
export type ExpertErrorCode = CommonErrorCode;

export class ExpertError extends ServiceError<ExpertErrorCode> {
  constructor(code: ExpertErrorCode, message: string) {
    super(code, message, ExpertErrors[code]);
    this.name = 'ExpertError';
  }
}

export const handleExpertError = createErrorHandler(ExpertErrors, 'Expert');
