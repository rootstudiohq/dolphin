import chalk from 'chalk';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import stripAnsi from 'strip-ansi';
import winston from 'winston';
import 'winston-daily-rotate-file';

const onlyConsole = winston.format((info, opts) => {
  if (!info.console) {
    return false;
  }
  return info;
});

export function getLogDirectory(): string {
  const platform = process.platform;
  const home = os.homedir();
  const appName = 'Dolphin';

  switch (platform) {
    case 'darwin': // macOS
      return path.join(home, 'Library/Logs', appName);
    case 'win32': // Windows
      return path.join(home, 'AppData/Roaming', appName, 'logs');
    case 'linux': // Linux
      // Follow XDG Base Directory Specification
      const xdgStateHome =
        process.env.XDG_STATE_HOME || path.join(home, '.local/state');
      return path.join(xdgStateHome, appName.toLowerCase(), 'logs');
    case 'freebsd':
    case 'openbsd':
    case 'netbsd':
      // BSD systems typically follow similar conventions to Linux
      return path.join(home, `.${appName.toLowerCase()}`, 'logs');
    default:
      // Fallback for other platforms
      return path.join(home, `.${appName.toLowerCase()}`, 'logs');
  }
}

function createLogger() {
  const level = process.env.NODE_ENV === 'production' ? 'info' : 'debug';
  const format = winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss Z',
    }),
  );

  const transports: winston.transport[] = [];
  // Display user friendly message in console
  const consoleTransport = new winston.transports.Console({
    format: winston.format.combine(
      onlyConsole(),
      winston.format.printf((info) => {
        const { message, stack } = info;
        let result = '';
        if (stack) {
          result += chalk.red(`${stack}`);
        } else {
          result += message;
        }
        return result;
      }),
    ),
    handleExceptions: true,
  });
  transports.push(consoleTransport);

  if (process.env.NODE_ENV !== 'test') {
    const logDirectory = getLogDirectory();
    // Create directory recursively if it doesn't exist
    if (!fs.existsSync(logDirectory)) {
      fs.mkdirSync(logDirectory, { recursive: true });
    }
    // Store all logs in file
    const fileTransport = new winston.transports.DailyRotateFile({
      filename: 'dolphin-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: false,
      maxSize: '20m',
      maxFiles: '7d',
      dirname: logDirectory,
      format: winston.format.combine(
        winston.format.printf((info) => {
          const { timestamp, level, message, stack } = info;
          let result = '';
          if (stack) {
            result += `${timestamp} [${level}]: ${stack}`;
          } else {
            result += `${timestamp} [${level}]: ${message}`;
          }
          return stripAnsi(result); // remove chalk colors
        }),
      ),
      handleExceptions: true,
    });
    transports.push(fileTransport);
  }

  const logger = winston.createLogger({
    level: level,
    format,
    transports,
  });

  const consoleLogger = logger.child({ console: true });
  return {
    consoleLogger,
    logger,
  };
}

const l = createLogger();
export const consoleLogger = l.consoleLogger;
export const logger = l.logger;
