import { Controller, Get } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GetNodeTypesQuery } from '../../application/queries/get-node-types.query';
import { NodeTypeDefinition } from '../../domain/entities/node-type-definition.entity';
import { NodeTypeDefinitionResponseDto } from './dtos/node-type-definition-response.dto';

@ApiTags('Catalog')
@Controller('api/node-types')
export class NodeTypesController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({ summary: 'Get all available node types' })
  @ApiResponse({
    status: 200,
    description: 'Return all active node types',
    type: [NodeTypeDefinitionResponseDto],
  })
  async getNodeTypes() {
    const result: NodeTypeDefinition[] = await this.queryBus.execute(
      new GetNodeTypesQuery(),
    );
    return {
      success: true,
      data: result.map(NodeTypeDefinitionResponseDto.fromDomain),
    };
  }
}
