/** Base class for application errors with HTTP status code. */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
  }
}

/** Error representing a resource that could not be found (HTTP 404). */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

/** Error representing a missing or invalid authentication credential (HTTP 401). */
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

/** Error representing invalid input data (HTTP 400). */
export class ValidationError extends AppError {
  constructor(message = 'Validation failed') {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

/** Error representing a failure in a downstream service (HTTP 502 by default). */
export class DownstreamError extends AppError {
  constructor(message = 'Downstream service error', statusCode = 502, code = 'DOWNSTREAM_ERROR') {
    super(message, statusCode, code);
  }
}
