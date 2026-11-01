import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@app/auth/infrastructure/guards/jwt-auth.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '@app/auth/infrastructure/decorators/current-user.decorator';
import { ActivationService } from '../../application/activation.service';
import { TestListenService } from '../../application/test-listen.service';

@ApiTags('workflows')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/workflows')
export class WorkflowActivationController {
  constructor(
    private readonly activation: ActivationService,
    private readonly testListen: TestListenService,
  ) {}

  @Get(':id/activation')
  @ApiOperation({
    summary: 'Whether the workflow is active, and with which version',
  })
  async state(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { success: true, data: await this.activation.state(id, user.id) };
  }

  @Post(':id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Turn the workflow on: its published version listens for events',
  })
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { success: true, data: await this.activation.activate(id, user.id) };
  }

  @Post(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Turn the workflow off and remove its webhooks' })
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      success: true,
      data: await this.activation.deactivate(id, user.id),
    };
  }

  @Get(':id/webhooks')
  @ApiOperation({ summary: 'Webhook URLs of the draft’s trigger nodes' })
  async webhooks(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { success: true, data: await this.activation.webhooks(id, user.id) };
  }

  @Post(':id/nodes/:nodeId/test-listen')
  @ApiOperation({
    summary: 'Wait up to 2 minutes for one real event of a trigger node',
  })
  async startTestListen(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('nodeId') nodeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      success: true,
      data: await this.testListen.start(id, nodeId, user.id),
    };
  }
}

@ApiTags('workflows')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/test-events')
export class TestEventsController {
  constructor(private readonly testListen: TestListenService) {}

  @Get(':listenId')
  @ApiOperation({ summary: 'Outcome of a test listen' })
  async get(
    @Param('listenId', ParseUUIDPipe) listenId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      success: true,
      data: await this.testListen.get(listenId, user.id),
    };
  }

  @Delete(':listenId')
  @ApiOperation({ summary: 'Stop waiting for a test event' })
  async stop(
    @Param('listenId', ParseUUIDPipe) listenId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.testListen.stop(listenId, user.id);
    return { success: true };
  }
}
