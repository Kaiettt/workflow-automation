export abstract class RefreshTokenRepository {
  abstract save(
    userId: string,
    token: string,
    ttlSeconds: number,
  ): Promise<void>;
  abstract validate(userId: string, token: string): Promise<boolean>;
  abstract revoke(userId: string): Promise<void>;
  abstract revokeBefore(userId: string, sessionVersion: number): Promise<void>;
}
