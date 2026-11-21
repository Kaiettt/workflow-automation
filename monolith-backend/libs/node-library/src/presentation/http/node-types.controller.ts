import {
  Controller,
  Get,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '@app/auth/infrastructure/guards/jwt-auth.guard';
import { GetNodeMetadataQuery } from '../../application/queries/get-node-metadata.query';
import { NodeMetadataQueryDto } from './dtos/node-metadata-query.dto';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GetNodeTypesQuery } from '../../application/queries/get-node-types.query';
import { NodeTypeDefinition } from '../../domain/entities/node-type-definition.entity';
import { NodeTypeDefinitionResponseDto } from './dtos/node-type-definition-response.dto';

@ApiTags('Catalog')
@Controller('api/node-types')
export class NodeTypesController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('metadata')
  @UseGuards(JwtAuthGuard)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  @ApiOperation({
    summary: 'Get metadata for existing workflow nodes, including hidden types',
  })
  async metadata(@Query() query: NodeMetadataQueryDto) {
    const result = await this.queryBus.execute<
      GetNodeMetadataQuery,
      NodeTypeDefinition[]
    >(new GetNodeMetadataQuery(query.keys));
    return {
      success: true,
      data: result.map((node) =>
        NodeTypeDefinitionResponseDto.fromDomain(node),
      ),
    };
  }
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
      data: result.map((n) => NodeTypeDefinitionResponseDto.fromDomain(n)),
    };
  }
}
