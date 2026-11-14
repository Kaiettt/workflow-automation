export abstract class SessionAccessPort {
  abstract isActive(userId: string): Promise<boolean>;
  abstract isCurrent(
    userId: string,
    version: number | undefined,
  ): Promise<boolean>;
}
