import { Controller, Get, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { GetConnectorsQuery } from '../../application/queries/get-connectors.query';
import { JwtAuthGuard } from '../../../../auth/src/infrastructure/guards/jwt-auth.guard';
import { Connector } from '../../domain/entities/connector.entity';
import { ConnectorResponseDto } from './dtos/connector-response.dto';

@ApiTags('Catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/connectors')
export class ConnectorsController {
  constructor(private readonly queryBus: QueryBus) {}

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
      data: result.map(ConnectorResponseDto.fromDomain),
    };
  }
}
