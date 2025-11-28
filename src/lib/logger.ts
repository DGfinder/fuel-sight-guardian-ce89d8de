/**
 * Logger utility - only logs in development mode
 * Replaces direct console.log calls throughout the codebase
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerOptions {
  prefix?: string;
  showTimestamp?: boolean;
}

const isDev = import.meta.env.DEV;

const formatMessage = (level: LogLevel, prefix?: string): string => {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
  const levelEmoji = {
    debug: '🔍',
    info: 'ℹ️',
    warn: '⚠️',
    error: '❌'
  }[level];

  return prefix ? `${levelEmoji} [${timestamp}] [${prefix}]` : `${levelEmoji} [${timestamp}]`;
};

export const logger = {
  /**
   * Debug logging - only in development
   */
  debug: (message: string, ...args: unknown[]) => {
    if (isDev) {
      console.log(formatMessage('debug'), message, ...args);
    }
  },

  /**
   * Info logging - only in development
   */
  info: (message: string, ...args: unknown[]) => {
    if (isDev) {
      console.info(formatMessage('info'), message, ...args);
    }
  },

  /**
   * Warning logging - only in development
   */
  warn: (message: string, ...args: unknown[]) => {
    if (isDev) {
      console.warn(formatMessage('warn'), message, ...args);
    }
  },

  /**
   * Error logging - always logs (production needs error visibility)
   * In production, could be extended to send to Sentry
   */
  error: (message: string, ...args: unknown[]) => {
    console.error(formatMessage('error'), message, ...args);
    // TODO: In production, send to Sentry
    // if (!isDev && typeof Sentry !== 'undefined') {
    //   Sentry.captureMessage(message, { extra: { args } });
    // }
  },

  /**
   * Create a prefixed logger instance for a specific module
   */
  create: (prefix: string) => ({
    debug: (message: string, ...args: unknown[]) => {
      if (isDev) {
        console.log(formatMessage('debug', prefix), message, ...args);
      }
    },
    info: (message: string, ...args: unknown[]) => {
      if (isDev) {
        console.info(formatMessage('info', prefix), message, ...args);
      }
    },
    warn: (message: string, ...args: unknown[]) => {
      if (isDev) {
        console.warn(formatMessage('warn', prefix), message, ...args);
      }
    },
    error: (message: string, ...args: unknown[]) => {
      console.error(formatMessage('error', prefix), message, ...args);
    }
  })
};

export default logger;
