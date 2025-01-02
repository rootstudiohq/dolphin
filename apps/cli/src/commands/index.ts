import { logger } from '@repo/base/logger';
import { CommandModule } from 'yargs';

import exportCommand from './export.js';
import importCommand from './import.js';
import localizeCommand from './localize.js';

// import translateCommand from './translate.js';

process.on('unhandledRejection', (reason, promise) => {
  console.log('Unhandled Rejection at:', (reason as any).stack || reason);
  // Recommended: send the information to sentry.io
  // or whatever crash reporting service you use
});

process.on('uncaughtException', (error) => {
  console.log('Uncaught Exception at:', error.stack || error);
  // Recommended: send the information to sentry.io
  // or whatever crash reporting service you use
});

export const commands: CommandModule<{}, any>[] = [
  // exportCommand,
  // importCommand,
  localizeCommand,
  // translateCommand,
];
