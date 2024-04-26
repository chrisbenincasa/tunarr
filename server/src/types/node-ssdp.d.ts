// Some rudimentary types so that linters, etc don't complain.
// This isn't exactly what node-ssdp supports, but eventually
// we will provide our own, modern implementation.
declare module 'node-ssdp' {
  type ServerOptions = {
    location: {
      port: number;
      path: string;
    };
    udn: string;
    allowWildcards: boolean;
    ssdpSig: string;
    customLogger?: (...args: unknown[]) => void;
  };

  class Server {
    constructor(options: ServerOptions);
    addUSN(usn: string): void;
    start(cb?: (...args: unknown[]) => void): Promise<void>;
  }
}
