export abstract class WebhookDedupPort {
  // True the first time a key is seen within the TTL, false for repeats.
  abstract claim(key: string, ttlSeconds: number): Promise<boolean>;
}
