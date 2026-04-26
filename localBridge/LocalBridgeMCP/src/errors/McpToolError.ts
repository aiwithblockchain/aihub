import type { ErrorCode } from './codes.js';

export interface McpToolErrorOptions {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

export class McpToolError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(options: McpToolErrorOptions) {
    super(options.message);
    this.name = 'McpToolError';
    this.code = options.code;
    this.details = options.details;
  }
}
