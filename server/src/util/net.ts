import { isNull, isString } from 'lodash-es';
import net from 'node:net';

export async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, () => {
      const addr = server.address();
      server.close(() => {
        if (isString(addr) || isNull(addr)) {
          reject(new Error('Server was not open on a port'));
        } else {
          resolve(addr.port);
        }
      });
    });
  });
}
