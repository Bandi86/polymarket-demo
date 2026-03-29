// Error Handling Utilities
// Centralized error handling for API routes and services

import { NextResponse } from 'next/server';

// Error codes for consistent error responses
export enum ErrorCode {
  // Client errors (4xx)
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  // Server errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
}

// Custom error class with code
export class AppError extends Error {
  code: ErrorCode;
  statusCode: number;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.INTERNAL_ERROR,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  static badRequest(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(message, ErrorCode.BAD_REQUEST, 400, details);
  }

  static unauthorized(message: string = 'Unauthorized'): AppError {
    return new AppError(message, ErrorCode.UNAUTHORIZED, 401);
  }

  static forbidden(message: string = 'Forbidden'): AppError {
    return new AppError(message, ErrorCode.FORBIDDEN, 403);
  }

  static notFound(message: string = 'Not found'): AppError {
    return new AppError(message, ErrorCode.NOT_FOUND, 404);
  }

  static conflict(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(message, ErrorCode.CONFLICT, 409, details);
  }

  static validationError(message: string, details?: Record<string, unknown>): AppError {
    return new AppError(message, ErrorCode.VALIDATION_ERROR, 422, details);
  }

  static internal(message: string = 'Internal server error'): AppError {
    return new AppError(message, ErrorCode.INTERNAL_ERROR, 500);
  }

  static serviceUnavailable(message: string = 'Service unavailable'): AppError {
    return new AppError(message, ErrorCode.SERVICE_UNAVAILABLE, 503);
  }

  static externalApiError(service: string, originalError?: Error): AppError {
    return new AppError(
      `External API error: ${service}`,
      ErrorCode.EXTERNAL_API_ERROR,
      502,
      { service, originalError: originalError?.message }
    );
  }

  static databaseError(operation: string, originalError?: Error): AppError {
    return new AppError(
      `Database error: ${operation}`,
      ErrorCode.DATABASE_ERROR,
      500,
      { operation, originalError: originalError?.message }
    );
  }
}

// API error response format
interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

// Convert AppError to NextResponse
export function errorResponse(error: AppError | Error): NextResponse<ErrorResponse> {
  console.error('[API Error]', error);

  if (error instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.statusCode }
    );
  }

  // Unknown error - return generic message
  return NextResponse.json(
    {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'An unexpected error occurred',
      },
    },
    { status: 500 }
  );
}

// Success response helper
export function successResponse<T>(data: T, status = 200): NextResponse<{ success: true; data: T }> {
  return NextResponse.json({ success: true, data }, { status });
}

// Wrap async handler with error handling
export function withErrorHandler<T>(
  handler: () => Promise<NextResponse<T>>
): Promise<NextResponse<T | ErrorResponse>> {
  return handler().catch((error) => errorResponse(error));
}

// Try-catch wrapper for services
export async function tryCatch<T, E = Error>(
  promise: Promise<T>
): Promise<[T | null, E | null]> {
  try {
    const data = await promise;
    return [data, null];
  } catch (error) {
    return [null, error as E];
  }
}

// Validate required fields
export function validateRequired(
  data: Record<string, unknown>,
  fields: string[]
): void {
  const missing = fields.filter(field => {
    const value = data[field];
    return value === undefined || value === null || value === '';
  });

  if (missing.length > 0) {
    throw AppError.validationError(
      `Missing required fields: ${missing.join(', ')}`,
      { missing }
    );
  }
}

// Validate numeric range
export function validateRange(
  value: number,
  min: number,
  max: number,
  fieldName: string
): void {
  if (value < min || value > max) {
    throw AppError.validationError(
      `${fieldName} must be between ${min} and ${max}`,
      { field: fieldName, min, max, actual: value }
    );
  }
}

// Validate enum value
export function validateEnum<T extends string>(
  value: string,
  allowed: T[],
  fieldName: string
): T {
  if (!allowed.includes(value as T)) {
    throw AppError.validationError(
      `Invalid ${fieldName}. Allowed: ${allowed.join(', ')}`,
      { field: fieldName, allowed, actual: value }
    );
  }
  return value as T;
}

// Log error with context
export function logError(
  context: string,
  error: Error | unknown,
  additionalData?: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();
  const errorInfo = error instanceof Error
    ? { message: error.message, stack: error.stack }
    : { error };

  console.error(`[${timestamp}] [${context}]`, errorInfo, additionalData || '');
}

// Rate limit error
export class RateLimitError extends AppError {
  constructor(retryAfter: number) {
    super(
      'Too many requests',
      ErrorCode.BAD_REQUEST,
      429,
      { retryAfter }
    );
    this.name = 'RateLimitError';
  }
}