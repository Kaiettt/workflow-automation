import {
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { WebhookRequest } from '@app/apps';
import {
  ReceiveWebhookCommand,
  ReceiveWebhookResult,
} from '../../application/commands/receive-webhook.command';

// Public entry point of every webhook endpoint. Callers prove themselves the
// way their package decides (secret URL, signature), never with a JWT.
@ApiTags('webhooks')
@Controller('api/webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly commandBus: CommandBus) {}

  @Get(':id')
  @ApiOperation({
    summary: 'Webhook call or setup check (e.g. Meta verification)',
  })
  get(
    @Param('id') id: string,
    @Req() request: RawBodyRequest<Request>,
    @Res() response: Response,
  ) {
    return this.receive(id, request, response);
  }

  @Post(':id')
  @ApiOperation({ summary: 'Receive events of a trigger' })
  post(
    @Param('id') id: string,
    @Req() request: RawBodyRequest<Request>,
    @Res() response: Response,
  ) {
    return this.receive(id, request, response);
  }

  private async receive(
    id: string,
    request: RawBodyRequest<Request>,
    response: Response,
  ) {
    const incoming: WebhookRequest = {
      method: request.method.toUpperCase(),
      headers: request.headers,
      query: request.query,
      body: request.method === 'GET' ? null : (request.body as unknown),
      rawBody: request.rawBody,
    };

    let result: ReceiveWebhookResult;
    try {
      result = await this.commandBus.execute<
        ReceiveWebhookCommand,
        ReceiveWebhookResult
      >(new ReceiveWebhookCommand(id, incoming));
    } catch (error) {
      this.logger.error(
        `Handling webhook ${id} failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      response.status(500).json({ success: false });
      return;
    }

    if (result.outcome === 'not-found') {
      const notFound = new NotFoundException(
        'This webhook is not listening. Activate the workflow, or use “Listen for test event”.',
      );
      response.status(404).json(notFound.getResponse());
      return;
    }
    response.status(result.status);
    if (result.contentType) response.type(result.contentType);
    if (typeof result.body === 'string') response.send(result.body);
    else response.json(result.body);
  }
}
