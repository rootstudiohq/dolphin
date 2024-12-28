import { logger } from '@repo/base/logger';
import spinner from '@repo/base/spinner';
import { TranslationMode, translateBundle } from '@repo/translate';
import chalk from 'chalk';
import { Arguments, ArgumentsCamelCase, Argv, CommandModule } from 'yargs';

interface CmdArgs extends Arguments {
  path: string;
  base?: string;
  apikey?: string;
  mode: TranslationMode;
}

const cmd: CommandModule<{}, CmdArgs> = {
  command: 'translate',
  describe:
    'Automatically export localized strings to be translated from project',
  builder: (yargs: Argv<{}>) => {
    return yargs.options({
      path: {
        alias: 'p',
        describe: 'Path to the localization bundle file',
        default: '.',
        type: 'string',
      },
      base: {
        describe: 'Base language of the localization bundle',
        type: 'string',
      },
      apikey: {
        alias: 'k',
        describe: 'Dolphin API key',
        type: 'string',
      },
      mode: {
        alias: 'm',
        choices: Object.values(TranslationMode),
        default: TranslationMode.AUTOMATIC,
        description: 'Translation mode',
      },
    });
  },
  handler: async (args: ArgumentsCamelCase<CmdArgs>) => {
    try {
      await handleTranslateCommand(args);
    } catch (e) {
      spinner.fail(
        chalk.red(`Failed to translate strings: ${(e as Error).stack}`),
      );
      process.exit(1);
    }
  },
};

export default cmd;

async function handleTranslateCommand(args: CmdArgs) {
  logger.info(`Translating localization bundle at ${args.path}`);
  if (!args.path) {
    throw new Error(`Missing localization bundle path: ${args.path}`);
  }
  if (!args.base) {
    throw new Error(`Missing base language: ${args.base}`);
  }
  // await translateBundle(
  //   [args.path],
  //   {
  //     agent: 'openai',
  //     mode: args.mode,
  //   },
  //   args.apikey,
  //   undefined,
  //   args.base,
  //   false,
  //   undefined,
  // );
  // logger.info(`Translated localization`);
}
