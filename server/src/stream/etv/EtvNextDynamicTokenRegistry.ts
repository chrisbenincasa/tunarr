import { bindingScopeValues, injectable } from 'inversify';
import { randomBytes } from 'node:crypto';
import type { Maybe } from '../../types/util.ts';
import { safeEqual } from '../../util/basicAuth.ts';

/** What a valid token grants access to. */
export type EtvNextTokenGrant = {
  channelUuid: string;
  channelNumber: number;
};

type Registration = EtvNextTokenGrant & { token: string };

/**
 * The bearer tokens the dynamic resolver accepts, one per running session.
 *
 * A token is minted when a session starts and dropped when it stops, so
 * nothing is persisted and a token cannot outlive the worker it was issued
 * for. The channel it grants comes from the registration rather than from the
 * request, which keeps the worker's `x-etv-channel` header out of the
 * authorization decision.
 *
 * Singleton-scoped, or a session would mint its token into a registry the
 * resolver does not read.
 */
@injectable(bindingScopeValues.Singleton)
export class EtvNextDynamicTokenRegistry {
  #byChannel = new Map<string, Registration>();

  /** Mints a token for a channel, replacing any token it already held. */
  issue(channelUuid: string, channelNumber: number): string {
    const token = randomBytes(32).toString('base64url');
    this.#byChannel.set(channelUuid, { channelUuid, channelNumber, token });
    return token;
  }

  revoke(channelUuid: string): void {
    this.#byChannel.delete(channelUuid);
  }

  get size(): number {
    return this.#byChannel.size;
  }

  /**
   * Finds what a presented token grants, or nothing.
   *
   * Every candidate is compared in constant time, so a caller cannot learn a
   * token by measuring how long a rejection takes.
   */
  resolve(token: string | undefined): Maybe<EtvNextTokenGrant> {
    if (token === undefined || token.length === 0) {
      return undefined;
    }

    for (const registration of this.#byChannel.values()) {
      if (safeEqual(token, registration.token)) {
        return {
          channelUuid: registration.channelUuid,
          channelNumber: registration.channelNumber,
        };
      }
    }

    return undefined;
  }
}

/** Pulls the credential out of an `Authorization: Bearer <token>` header. */
export function parseBearerToken(header: string | undefined): Maybe<string> {
  if (header === undefined) {
    return undefined;
  }

  const prefix = 'bearer ';
  if (!header.toLowerCase().startsWith(prefix)) {
    return undefined;
  }

  const token = header.slice(prefix.length).trim();
  return token.length > 0 ? token : undefined;
}
