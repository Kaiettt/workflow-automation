import { HttpException, HttpStatus } from '@nestjs/common';

export class SubscriptionExpiredException extends HttpException {
  constructor() {
    super(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        error: 'SUBSCRIPTION_EXPIRED',
        message: 'Subscription expired. Renew or switch to the Free plan.',
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
