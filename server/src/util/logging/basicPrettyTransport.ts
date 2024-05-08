import { once } from 'events';
import { createWriteStream } from 'fs';

export default async (options) => {
  console.log(options);
  const stream = createWriteStream('test.log');
  await once(stream, 'open');
  return stream;
};
