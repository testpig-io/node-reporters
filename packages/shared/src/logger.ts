/**
 * Simple logger utility for TestPig components
 * Logs are only shown when TESTPIG_DEBUG_LOGS is set
 */

// Check if debug logs are enabled
const DEBUG_ENABLED = process.env.TESTPIG_DEBUG_LOGS === 'true';

// ANSI color codes
const COLORS = {
  BLUE: '\x1b[34m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  RED: '\x1b[31m',
  RESET: '\x1b[0m'
};

// Log levels
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

/**
 * Logger class for TestPig components
 * Will only log DEBUG and INFO when TESTPIG_DEBUG_LOGS is set to 'true'
 * WARN and ERROR logs are always displayed
 */
export class Logger {
  private component: string;

  /**
   * Create a new logger for a component
   * @param component - The name of the component (e.g., 'APIClient')
   */
  constructor(component: string) {
    this.component = component;
  }

  /**
   * Format a log message with the TestPig prefix and component name
   * @param level - Log level (DEBUG, INFO, WARN, ERROR)
   * @param message - The message to log
   * @param data - Optional data to log
   * @returns Formatted log message
   */
  private format(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    let color = COLORS.RESET;
    
    switch (level) {
      case LogLevel.DEBUG:
        color = COLORS.BLUE;
        break;
      case LogLevel.INFO:
        color = COLORS.GREEN;
        break;
      case LogLevel.WARN:
        color = COLORS.YELLOW;
        break;
      case LogLevel.ERROR:
        color = COLORS.RED;
        break;
    }
    
    const prefix = `${color}[TESTPIG][${timestamp}][${level}][${this.component}]${COLORS.RESET}`;
    return `${prefix} ${message}`;
  }

  /**
   * Log a debug message
   * @param message - The message to log
   * @param data - Optional data to log
   */
  debug(message: string, data?: any): void {
    if (DEBUG_ENABLED) {
      console.log(this.format(LogLevel.DEBUG, message));
      if (data !== undefined) {
        console.log(data);
      }
    }
  }

  /**
   * Log an info message
   * @param message - The message to log
   * @param data - Optional data to log
   */
  info(message: string, data?: any): void {
    if (DEBUG_ENABLED) {
      console.log(this.format(LogLevel.INFO, message));
      if (data !== undefined) {
        console.log(data);
      }
    }
  }

  /**
   * Log a warning message
   * @param message - The message to log
   * @param data - Optional data to log
   */
  warn(message: string, data?: any): void {
    // Always log warnings
    console.warn(this.format(LogLevel.WARN, message));
    if (data !== undefined) {
      console.warn(data);
    }
  }

  /**
   * Log an error message
   * @param message - The message to log
   * @param error - The error object or message
   */
  error(message: string, error?: any): void {
    // Always log errors
    console.error(this.format(LogLevel.ERROR, message));
    if (error !== undefined) {
      console.error(error);
    }
  }
}

/**
 * Create a logger for a component
 * @param component - The name of the component
 * @returns A logger instance
 */
export function createLogger(component: string): Logger {
  return new Logger(component);
} 