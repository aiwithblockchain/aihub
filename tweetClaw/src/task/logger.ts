export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

class Logger {
    private level: LogLevel = 'info';

    setLevel(level: LogLevel) {
        this.level = level;
    }

    private shouldLog(level: LogLevel): boolean {
        const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'none'];
        return levels.indexOf(level) >= levels.indexOf(this.level);
    }

    debug(...args: any[]) { if (this.shouldLog('debug')) console.log('[DEBUG]', ...args); }
    info(...args: any[]) { if (this.shouldLog('info')) console.info('[INFO]', ...args); }
    warn(...args: any[]) { if (this.shouldLog('warn')) console.warn('[WARN]', ...args); }
    error(...args: any[]) { if (this.shouldLog('error')) console.error('[ERROR]', ...args); }
}

export const logger = new Logger();

if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'production') {
    logger.setLevel('warn');
}
