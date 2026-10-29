import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  ReceiveWebhookCommand,
  ReceiveWebhookResult,
} from '../../application/commands/receive-webhook.command';

// Public: callers are not FlowPilot users. The secret token in the URL is the
// only credential, so no JWT guard here.
@ApiTags('webhooks')
@Controller('api/webhooks')
export class WebhooksController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('w/:token')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Start the workflow listening on this webhook URL',
  })
  async receive(
    @Param('token') token: string,
    @Body() body: unknown,
    @Query() query: Record<string, unknown>,
    @Req() request: Request,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const result = await this.commandBus.execute<
      ReceiveWebhookCommand,
      ReceiveWebhookResult
    >(
      new ReceiveWebhookCommand(
        token,
        { body, query, headers: request.headers },
        idempotencyKey?.trim() || undefined,
      ),
    );
    return { success: true, data: result };
  }
}
