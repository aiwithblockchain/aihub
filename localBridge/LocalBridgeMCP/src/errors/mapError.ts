import { ZodError } from 'zod';
import { ErrorCodes } from './codes.js';
import { McpToolError } from './McpToolError.js';

export function mapError(error: unknown): McpToolError {
  if (error instanceof McpToolError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new McpToolError({
      code: ErrorCodes.INVALID_ARGUMENT,
      message: 'Invalid tool input.',
      details: error.flatten(),
    });
  }

  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return new McpToolError({
        code: ErrorCodes.TIMEOUT,
        message: 'Request to LocalBridge timed out.',
      });
    }

    return new McpToolError({
      code: ErrorCodes.UPSTREAM_EXECUTION_FAILED,
      message: error.message || 'Upstream execution failed.',
    });
  }

  return new McpToolError({
    code: ErrorCodes.INTERNAL_ERROR,
    message: 'Unknown internal error.',
    details: error,
  });
}
