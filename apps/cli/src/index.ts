import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { version } from '../package.json';
import { commands } from './commands/index.js';

const parser = yargs(hideBin(process.argv))
  .command(commands)
  .version(version)
  .help()
  .alias('help', 'h');

(async () => {
  await parser.argv;
})();
