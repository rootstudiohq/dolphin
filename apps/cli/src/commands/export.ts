import { logger } from '@repo/base/logger';
import spinner from '@repo/base/spinner';
import chalk from 'chalk';
import { Arguments, ArgumentsCamelCase, Argv, CommandModule } from 'yargs';

import { exportLocalizations, loadConfig } from './core.js';

interface CmdArgs extends Arguments {
  config?: string;
}

const cmd: CommandModule<{}, CmdArgs> = {
  command: 'export',
  describe:
    'Automatically export localized strings to be translated from project',
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
      await handleExportCommand(args);
    } catch (e) {
      spinner.fail(
        chalk.red(`Failed to export localized strings: ${(e as Error).stack}`),
      );
      process.exit(1);
    }
  },
};

export default cmd;

async function handleExportCommand(args: CmdArgs) {
  logger.info('\n\n\n\n\n');
  logger.info('===================================');
  logger.info('============= Exporting ===========');
  logger.info('===================================');
  if (!args.config) {
    spinner.fail(chalk.red('Config file path is not specified'));
    return;
  }
  const config = await loadConfig({
    path: args.config,
  });
  const res = await exportLocalizations(config);
  spinner.next(chalk.green(`Done`)).succeed(undefined, { logging: false });
  logger.info(`Exported localization: ${JSON.stringify(res)}`);
}
