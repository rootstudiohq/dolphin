import * as Sentry from '@sentry/node';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import pkg from '../package.json' assert { type: 'json' };
import { commands } from './commands/index.js';

const { version } = pkg;

/** Setup Sentry for error tracking if needed */
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    release: version,
    tracesSampleRate: 1.0, //  Capture 100% of the transactions
  });
}

const parser = yargs(hideBin(process.argv))
  .command(commands)
  .version(version)
  .help()
  .alias('help', 'h');

export const cli = async () => {
  await parser.argv;
};
