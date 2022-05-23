#!/usr/bin/env node

import yargs from 'yargs';
// eslint-disable-next-line import/extensions
import fingerprint from '../fingerprint.js';

const options = yargs(process.argv.slice(2))
  .usage('Usage: --query <sql>')
  .option('query', { describe: 'sql', type: 'string', demandOption: true })
  .option('matchMD5Checksum', { describe: 'Match MD5 checksums and replace as single values', type: 'boolean', demandOption: false })
  .option('matchEmbeddedNumbers', { describe: 'Match numbers embedded in words and replace as single values', type: 'boolean', demandOption: false })
  .argv;

const fp = fingerprint(options.query, options.matchMD5Checksum, options.matchEmbeddedNumbers);

// eslint-disable-next-line no-console
console.log(fp);
