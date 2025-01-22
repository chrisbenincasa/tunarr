import { once } from 'node:events';
import { createWriteStream } from 'node:fs';

export default async (options) => {
  console.log(options);
  const stream = createWriteStream('test.log');
  await once(stream, 'open');
  return stream;
};
