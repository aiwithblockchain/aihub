import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { McpToolError } from '../errors/McpToolError.js';
import type { ToolMeta } from './buildMeta.js';

export interface ToolPayload<TData> extends Record<string, unknown> {
  success: boolean;
  data: TData | null;
  error:
    | {
        code: string;
        message: string;
        details?: unknown;
      }
    | null;
  meta: ToolMeta;
}

export interface McpToolResponse<TData> extends CallToolResult {
  structuredContent: ToolPayload<TData>;
}

export function successResult<TData>(
  data: TData,
  meta: ToolMeta,
): McpToolResponse<TData> {
  const payload: ToolPayload<TData> = {
    success: true,
    data,
    error: null,
    meta,
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(payload, null, 2),
      },
    ],
    structuredContent: payload,
  };
}

export function errorResult(
  error: McpToolError,
  meta: ToolMeta,
): McpToolResponse<null> {
  const payload: ToolPayload<null> = {
    success: false,
    data: null,
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
    },
    meta,
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(payload, null, 2),
      },
    ],
    structuredContent: payload,
    isError: true,
  };
}
