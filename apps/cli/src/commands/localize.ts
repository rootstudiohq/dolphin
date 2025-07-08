import { consoleLogger, getLogDirectory, logger } from '@repo/base/logger';
import spinner from '@repo/base/spinner';
import chalk from 'chalk';
import { Arguments, ArgumentsCamelCase, Argv, CommandModule } from 'yargs';

import {
  exportLocalizations,
  formattedDuration,
  importLocalizations,
  loadConfig,
  translateLocalizations,
} from './core.js';

interface CmdArgs extends Arguments {
  config?: string;
}

const cmd: CommandModule<{}, CmdArgs> = {
  command: 'localize',
  describe:
    'Automatically localize the project, including exporting, translating and importing localization strings.',
  builder: (yargs: Argv<{}>) => {
    return yargs.options({
      config: {
        alias: 'c',
        describe:
          'Path to the config file. Will search dolphin.y[a]ml under root path if not specified',
        type: 'string',
      },
    });
  },
  handler: async (args: ArgumentsCamelCase<CmdArgs>) => {
    try {
      await handleLocalizeCommand(args);
    } catch (e) {
      spinner.fail(
        chalk.red(`Failed to localize strings: ${(e as Error).stack}`),
      );
      process.exit(1);
    }
  },
};

export default cmd;

async function handleLocalizeCommand(args: CmdArgs) {
  logger.info('\n\n\n\n\n');
  logger.info('===================================');
  logger.info('============= Localize ============');
  logger.info('===================================');
  consoleLogger.info(
    chalk.gray(`Detailed logs directory: ${getLogDirectory()}\n`),
  );
  var initialStartTime = performance.now();
  consoleLogger.info(`=== Step 0: Load config ===`);
  const config = await loadConfig({
    path: args.config,
  });
  /**
   * Localize process:
   * - Export localizations
   * - Translate localizations
   * - Import localizations
   */
  consoleLogger.info(`=== Step 1: Export strings ===`);
  const { baseOutputFolder: translationBundle, exportedResults } =
    await exportLocalizations(config);
  consoleLogger.info(`=== Step 2: Translate strings ===`);
  await translateLocalizations({
    baseOutputFolder: translationBundle,
    config,
  });
  consoleLogger.info(`=== Step 3: Import translations ===`);
  let metas: Record<string, { intermediateBundlePath?: string }> = {};
  for (const result of exportedResults) {
    if (result.meta) {
      metas[result.id] = result.meta;
    }
  }
  await importLocalizations({
    config,
    translationBundle,
    metas,
  });
  const duration = formattedDuration(performance.now() - initialStartTime);
  spinner
    .next(chalk.green(`Done (Total ${duration})`))
    .succeed(undefined, { logging: false });
}
