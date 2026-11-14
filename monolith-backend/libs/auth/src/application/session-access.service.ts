import { Injectable } from '@nestjs/common';
import { UserRepository } from '../domain/repositories/user.repository';
import { SessionAccessPort } from './session-access.port';

@Injectable()
export class SessionAccessService extends SessionAccessPort {
  constructor(private readonly users: UserRepository) {
    super();
  }
  async isActive(userId: string): Promise<boolean> {
    const user = await this.users.findById(userId);
    return Boolean(user?.isActive);
  }
  async isCurrent(
    userId: string,
    version: number | undefined,
  ): Promise<boolean> {
    const user = await this.users.findById(userId);
    return Boolean(
      user?.isActive &&
      version !== undefined &&
      user.sessionVersion === version,
    );
  }
}
