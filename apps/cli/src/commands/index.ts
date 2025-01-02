import { logger } from '@repo/base/logger';
import { CommandModule } from 'yargs';

import exportCommand from './export.js';
import importCommand from './import.js';
import localizeCommand from './localize.js';

// import translateCommand from './translate.js';

export const commands: CommandModule<{}, any>[] = [
  // exportCommand,
  // importCommand,
  localizeCommand,
  // translateCommand,
];
