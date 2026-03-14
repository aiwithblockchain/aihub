/**
 * Shared error codes across tools.
 * Source: docs/03-tool-contracts.md
 */
export type ErrorCode =
    | 'INVALID_PARAMETERS'
    | 'NOT_IMPLEMENTED'
    | 'TOOL_DISABLED'
    | 'SESSION_INVALID'
    | 'NO_BOUND_TAB'
    | 'NOT_ON_X'
    | 'ACCOUNT_UNRESOLVED'
    | 'EXTRACTION_FAILED'
    | 'RESOURCE_UNAVAILABLE'
    | 'POST_NOT_FOUND'
    | 'THREAD_UNAVAILABLE'
    | 'SEARCH_UNAVAILABLE'
    | 'TIMELINE_UNAVAILABLE'
    | 'DRAFT_FAILED'
    | 'APPROVAL_REQUIRED'
    | 'APPROVAL_EXPIRED'
    | 'APPROVAL_MISMATCH'
    | 'POLICY_DENIED'
    | 'EXECUTION_FAILED'
    | 'RESULT_UNRESOLVED'
    | 'AUDIT_UNAVAILABLE'
    | 'INTERNAL_ERROR';

export interface ToolError {
    code: ErrorCode;
    message: string;
    retryable?: boolean;
}

export interface ToolMetadata {
    traceId?: string;
    schemaVersion?: string;
    warnings?: string[];
}

export interface ToolResponse<T = any> {
    ok: boolean;
    data?: T;
    error?: ToolError;
    meta?: ToolMetadata;
}
