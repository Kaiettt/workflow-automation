import { TestListen } from '../../domain/trigger.types';

export abstract class TestEventStore {
  abstract save(listen: TestListen): Promise<void>;
  abstract get(listenId: string): Promise<TestListen | null>;
  // Listens of the endpoint still waiting for an event (not expired).
  abstract waitingFor(endpointId: string): Promise<TestListen[]>;
  abstract remove(listenId: string): Promise<void>;
}

export function isExpired(listen: TestListen, now = new Date()): boolean {
  return new Date(listen.expiresAt).getTime() <= now.getTime();
}
