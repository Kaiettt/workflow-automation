import { IEvent } from '@nestjs/cqrs';

export class PaymentCompletedEvent implements IEvent {
  constructor(
    public readonly userId: string,
    public readonly planId: string,
    public readonly orderCode: string,
  ) {}
}
