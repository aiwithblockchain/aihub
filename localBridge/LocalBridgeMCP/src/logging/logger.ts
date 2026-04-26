export interface Logger {
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
  debug(message: string, meta?: unknown): void;
}

export interface CreateLoggerOptions {
  debug: boolean;
}

function formatMeta(meta?: unknown): string {
  if (meta === undefined) {
    return '';
  }

  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return ' [unserializable-meta]';
  }
}

function writeLog(level: string, message: string, meta?: unknown): void {
  process.stderr.write(`[${level}] ${message}${formatMeta(meta)}\n`);
}

export function createLogger(options: CreateLoggerOptions): Logger {
  return {
    info(message, meta) {
      writeLog('INFO', message, meta);
    },
    warn(message, meta) {
      writeLog('WARN', message, meta);
    },
    error(message, meta) {
      writeLog('ERROR', message, meta);
    },
    debug(message, meta) {
      if (!options.debug) {
        return;
      }

      writeLog('DEBUG', message, meta);
    },
  };
}
