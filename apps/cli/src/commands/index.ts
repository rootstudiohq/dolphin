import { logger } from '@repo/base/logger';
import { CommandModule } from 'yargs';

import exportCommand from './export.js';
import importCommand from './import.js';
import localizeCommand from './localize.js';

// import translateCommand from './translate.js';

process.on('uncaughtException', function (err) {
  logger.log(
    'error',
    'Fatal uncaught exception',
    err,
    function (err, level, msg, meta) {
      process.exit(1);
    },
  );
});

export const commands: CommandModule<{}, any>[] = [
  // exportCommand,
  // importCommand,
  localizeCommand,
  // translateCommand,
];
