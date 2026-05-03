import dayjs from 'dayjs';
import { injectable } from 'inversify';
import NodeCache from 'node-cache';
import * as dns from 'node:dns/promises';
import * as net from 'node:net';
import { URL } from 'node:url';
import { Result } from '../../types/result.ts';

@injectable()
export class PlexHostLookup {
  private static cache = new NodeCache({
    stdTTL: dayjs.duration({ minutes: 5 }).asSeconds(),
  });

  async lookup(hostname: string): Promise<Result<string[]>> {
    let actualHostname = hostname;
    if (URL.canParse(hostname)) {
      actualHostname = URL.parse(hostname)!.hostname;
    }
    if (net.isIPv4(actualHostname)) {
      return Result.success([actualHostname]);
    }

    const cached = PlexHostLookup.cache.get<string[]>(actualHostname);
    if (cached) {
      return Result.success(cached);
    }

    const resolutionResult = await Result.attemptAsync(() =>
      dns.resolve(actualHostname, 'A'),
    );

    resolutionResult.forEach((res) => {
      PlexHostLookup.cache.set(actualHostname, res);
    });

    return resolutionResult;
  }
}
