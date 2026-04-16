import { TaskCancelledException } from './cancellation-token';

export interface TaskError {
  errorCode: string;
  errorMessage: string;
  phase: string;
}

export class ErrorHandler {
  static handleError(error: any, phase: string): TaskError {
    if (error instanceof TaskCancelledException) {
      return {
        errorCode: 'TASK_CANCELLED',
        errorMessage: 'Task was cancelled',
        phase
      };
    }
    
    const msg = error instanceof Error ? error.message : String(error);
    
    if (msg.includes('Failed to fetch part') || msg.includes('Invalid part index')) {
      return {
        errorCode: 'INPUT_FETCH_ERROR',
        errorMessage: msg,
        phase
      };
    }
    
    if (msg.includes('INIT failed')) {
      return {
        errorCode: 'TASK_PREPARE_ERROR',
        errorMessage: msg,
        phase
      };
    }

    if (
      msg.includes('Failed to start content task') ||
      msg.includes('Content task rejected') ||
      msg.includes('No x.com tab found')
    ) {
      return {
        errorCode: 'CONTENT_DISPATCH_ERROR',
        errorMessage: msg,
        phase
      };
    }

    if (
      msg.includes('Data integrity error')
      || msg.includes('size mismatch')
      || msg.includes('size overflow')
      || msg.includes('chunk count mismatch')
      || msg.includes('chunk overflow')
      || msg.includes('out of order')
    ) {
      return {
        errorCode: 'INPUT_VALIDATION_ERROR',
        errorMessage: msg,
        phase
      };
    }
    
    // Naive classification for typical browser fetch errors or known signatures
    if (msg.includes('network') || msg.toLowerCase().includes('fetch') || msg.includes('timeout')) {
      return {
        errorCode: 'NETWORK_ERROR',
        errorMessage: msg,
        phase
      };
    }
    
    if (msg.includes('auth') || msg.toLowerCase().includes('unauthorized') || msg.includes('403') || msg.includes('401')) {
      return {
        errorCode: 'AUTH_ERROR',
        errorMessage: msg,
        phase
      };
    }
    
    return {
      errorCode: 'TASK_EXECUTION_ERROR',
      errorMessage: msg || 'Unknown error',
      phase
    };
  }
}
