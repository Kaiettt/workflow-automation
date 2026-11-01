// One-time OAuth `state`: proves the callback answers a sign-in this server
// started, for which user and credential.
export abstract class OauthStateStore {
  abstract save(
    state: string,
    value: string,
    ttlSeconds: number,
  ): Promise<void>;
  // The stored value, removed at once so the state cannot be replayed.
  abstract take(state: string): Promise<string | null>;
}
