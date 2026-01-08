import { parseWebStream } from 'music-metadata';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { inspect } from 'node:util';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const args = yargs()
  .command('$0 <file>', 'Print metadata')
  .positional('file', {
    demandOption: true,
    type: 'string',
  })
  .option('full', {
    boolean: true,
    default: false,
  })
  .help()
  .parseSync(hideBin(process.argv));

const parsedTrackMetadata = await parseWebStream(
  Readable.toWeb(createReadStream(args.file)),
);

if (args.full) {
  console.log(inspect(parsedTrackMetadata, false, null, true));
} else {
  console.log(parsedTrackMetadata);
}
