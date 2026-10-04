import { Controller, Get } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { GetNodeTypesQuery } from '../../application/queries/get-node-types.query';
import type { NodeTypeDefinition } from '@prisma/client';

@ApiTags('Catalog')
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
