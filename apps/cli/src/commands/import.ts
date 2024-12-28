import { logger } from '@repo/base/logger';
import spinner from '@repo/base/spinner';
import chalk from 'chalk';
import { Arguments, ArgumentsCamelCase, Argv, CommandModule } from 'yargs';

import { importLocalizations, loadConfig } from './core.js';

interface CmdArgs extends Arguments {
  config: string;
  bundlePath: string;
}

const cmd: CommandModule<{}, CmdArgs> = {
  command: 'import',
  describe:
    'Automatically import localized strings to be translated from project',
  builder: (yargs: Argv<{}>) => {
    return yargs.options({
      config: {
        alias: 'c',
        describe:
          'Path to the config file. Will search dolphin.y[a]ml under root path if not specified',
        type: 'string',
        demandOption: true,
      },
      bundlePath: {
        alias: 'p',
        describe: 'Path to the transalted folder',
        type: 'string',
        demandOption: true,
      },
    });
  },
  handler: async (args: ArgumentsCamelCase<CmdArgs>) => {
    try {
      await handleImportCommand(args);
    } catch (e) {
      spinner.fail(
        chalk.red(`Failed to export localized strings: ${(e as Error).stack}`),
      );
      process.exit(1);
    }
  },
};

export default cmd;

async function handleImportCommand(args: CmdArgs) {
  logger.info('\n\n\n\n\n');
  logger.info('===================================');
  logger.info('============= Importing ===========');
  logger.info('===================================');
  if (!args.config) {
    spinner.fail(chalk.red('Config file path is not specified'));
    return;
  }
  const config = await loadConfig({
    path: args.config,
  });
  // const exportedResults = (args.results as string[]).map((result) => {
  //   return {
  //     bundlePath: result,
  //   };
  // });
  // await doctorCheck();
  // await importLocalizations({
  //   config,
  //   translationBundle: args.bundlePath,
  // });
  // spinner.next(chalk.green(`Done`)).succeed(undefined, { logger: false }));
}
