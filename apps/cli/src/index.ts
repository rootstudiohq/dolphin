import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { version } from '../package.json';
import { commands } from './commands/index.js';

// process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '1'
// process.env['NODE_NO_WARNINGS'] = '1'
// process.removeAllListeners('warning')

const parser = yargs(hideBin(process.argv))
  .command(commands)
  .version(version)
  .help()
  .alias('help', 'h');

(async () => {
  await parser.argv;
})();
