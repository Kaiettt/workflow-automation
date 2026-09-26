import { Controller, Get, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { GetNodeTypesQuery } from '../../application/queries/get-node-types.query';
import { JwtAuthGuard } from '../../../../auth/src/infrastructure/guards/jwt-auth.guard';
import type { NodeTypeDefinition } from '@prisma/client';

@ApiTags('Catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/node-types')
export class NodeTypesController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({ summary: 'Get all available node types' })
  @ApiResponse({ status: 200, description: 'Return all active node types' })
  async getNodeTypes() {
    const result: unknown = await this.queryBus.execute(
      new GetNodeTypesQuery(),
    );
    return {
      success: true,
      data: result as NodeTypeDefinition[],
    };
  }
}
