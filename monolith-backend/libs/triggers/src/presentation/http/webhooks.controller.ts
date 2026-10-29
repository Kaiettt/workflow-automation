import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  ReceiveWebhookCommand,
  ReceiveWebhookResult,
} from '../../application/commands/receive-webhook.command';
import {
  ReceiveMessengerEventsCommand,
  ReceiveMessengerEventsResult,
} from '../../application/commands/receive-messenger-events.command';
import { isValidMetaSignature } from '../../domain/messenger-event';

// Public: callers are not FlowPilot users. They prove themselves with the
// secret token in the URL (generic webhook) or a signature (Meta), so no JWT.
@ApiTags('webhooks')
@Controller('api/webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

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

  // Meta calls this once when the webhook is set up in the app dashboard.
  @Get('messenger')
  @Header('Content-Type', 'text/plain')
  @ApiExcludeEndpoint()
  verifyMessenger(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') verifyToken?: string,
    @Query('hub.challenge') challenge?: string,
  ): string {
    const expected = process.env['META_VERIFY_TOKEN'];
    if (mode !== 'subscribe' || !expected || verifyToken !== expected) {
      throw new ForbiddenException('Verification failed');
    }
    return challenge ?? '';
  }

  @Post('messenger')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async receiveMessenger(
    @Req() request: RawBodyRequest<Request>,
    @Body() body: unknown,
    @Headers('x-hub-signature-256') signature?: string,
  ) {
    if (
      !isValidMetaSignature(
        request.rawBody,
        signature,
        process.env['META_APP_SECRET'],
      )
    ) {
      throw new UnauthorizedException('Invalid signature');
    }
    // Meta disables webhooks that keep failing: always answer 200 once the
    // call is authentic, and keep the error in the server log.
    try {
      const result = await this.commandBus.execute<
        ReceiveMessengerEventsCommand,
        ReceiveMessengerEventsResult
      >(new ReceiveMessengerEventsCommand(body));
      return { success: true, data: result };
    } catch (error) {
      this.logger.error(
        `Messenger event handling failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return { success: false };
    }
  }
}
