import * as Sentry from '@sentry/node';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import pkg from '../package.json' with { type: 'json' };
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

yargs()
  .command(commands)
  .version(version)
  .help()
  .alias('help', 'h')
  .parse(hideBin(process.argv));
