/**
 * Standard API response wrappers used across all controllers.
 * Provides consistent structure for success and error responses.
 */

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
  requestId?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp: string;
  requestId?: string;
}

export function wrapSuccess<T>(data: T, requestId?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
    requestId,
  };
}

export function wrapError(
  code: string,
  message: string,
  details?: Record<string, unknown>,
  requestId?: string,
): ApiErrorResponse {
  return {
    success: false,
    error: { code, message, details },
    timestamp: new Date().toISOString(),
    requestId,
  };
}

/**
 * Helper to build a list summary for logging/auditing.
 */
export function buildAuditSummary(
  action: string,
  entityType: string,
  entityId: string,
  userId: string,
): Record<string, string> {
  return {
    action,
    entityType,
    entityId,
    userId,
    timestamp: new Date().toISOString(),
  };
}
