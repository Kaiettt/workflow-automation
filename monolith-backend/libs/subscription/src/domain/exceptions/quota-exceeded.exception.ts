import { HttpException, HttpStatus } from '@nestjs/common';

export class QuotaExceededException extends HttpException {
  constructor(
    message = 'Monthly execution quota exceeded. Please upgrade your plan.',
  ) {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'QUOTA_EXCEEDED',
        message,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
