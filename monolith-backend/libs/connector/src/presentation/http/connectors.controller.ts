import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { GetConnectorsQuery } from '../../application/queries/get-connectors.query';
import { ListCredentialsQuery } from '../../application/queries/list-credentials.query';
import { CreateApiKeyCredentialCommand } from '../../application/commands/create-api-key-credential.command';
import { CredentialSummary } from '../../application/dtos/credential-summary.dto';
import { JwtAuthGuard } from '../../../../auth/src/infrastructure/guards/jwt-auth.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../../../auth/src/infrastructure/decorators/current-user.decorator';
import { Connector } from '../../domain/entities/connector.entity';
import { ConnectorResponseDto } from './dtos/connector-response.dto';
import { CreateApiKeyCredentialDto } from './dtos/create-api-key-credential.dto';
import { CredentialResponseDto } from './dtos/credential-response.dto';

@ApiTags('Catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/connectors')
export class ConnectorsController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all available connectors' })
  @ApiResponse({
    status: 200,
    description: 'Return all active connectors',
    type: [ConnectorResponseDto],
  })
  async getConnectors() {
    const result: Connector[] = await this.queryBus.execute(
      new GetConnectorsQuery(),
    );
    return {
      success: true,
      data: result.map((c) => ConnectorResponseDto.fromDomain(c)),
    };
  }

  @Get(':connectorKey/credentials')
  @ApiOperation({ summary: 'List my credentials of a connector (no secrets)' })
  @ApiResponse({ status: 200, type: [CredentialResponseDto] })
  async listCredentials(
    @Param('connectorKey') connectorKey: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const result: CredentialSummary[] = await this.queryBus.execute(
      new ListCredentialsQuery(connectorKey, user.id),
    );
    return {
      success: true,
      data: result.map((c) => CredentialResponseDto.fromSummary(c)),
    };
  }

  @Post(':connectorKey/credentials')
  @ApiOperation({
    summary: 'Save a credential (API key or form fields) for a connector',
  })
  @ApiResponse({ status: 201, type: CredentialResponseDto })
  async createCredential(
    @Param('connectorKey') connectorKey: string,
    @Body() body: CreateApiKeyCredentialDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const secret = body.secret ?? body.api_key;
    if (secret === undefined) {
      throw new BadRequestException('api_key or secret is required');
    }
    const result: CredentialSummary = await this.commandBus.execute(
      new CreateApiKeyCredentialCommand(
        connectorKey,
        user.id,
        body.name,
        secret,
      ),
    );
    return { success: true, data: CredentialResponseDto.fromSummary(result) };
  }
}
