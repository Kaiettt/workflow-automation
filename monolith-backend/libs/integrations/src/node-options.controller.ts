import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PackageRegistry } from '@app/apps';
import { CredentialVault } from '@app/connector/application/credential-vault';
import { JwtAuthGuard } from '@app/auth/infrastructure/guards/jwt-auth.guard';
import {
  AuthenticatedUser,
  CurrentUser,
} from '@app/auth/infrastructure/decorators/current-user.decorator';

class LoadOptionsDto {
  @IsOptional()
  @IsString()
  credentialId?: string;
}

// Dynamic choices of a node field (n8n loadOptions), e.g. the Pages of a
// Facebook credential.
@ApiTags('Catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/node-types')
export class NodeOptionsController {
  constructor(
    private readonly registry: PackageRegistry,
    private readonly vault: CredentialVault,
  ) {}

  @Post(':key/options/:property')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Options of a node field, read with a credential' })
  async load(
    @Param('key') key: string,
    @Param('property') propertyName: string,
    @Body() body: LoadOptionsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const node = this.registry.node(key);
    const property = node?.properties.find((p) => p.name === propertyName);
    if (!node || !property?.loadOptions) {
      throw new NotFoundException('This field has no dynamic options');
    }

    let credential: Record<string, unknown> | null = null;
    if (node.credentialType) {
      const stored = await this.vault.findOwned(body.credentialId, user.id);
      if (!stored || stored.connectorKey !== node.credentialType) {
        throw new BadRequestException('Choose a credential first');
      }
      credential = stored.secret;
    }
    try {
      const options = await property.loadOptions({ credential });
      return { success: true, data: options };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Options could not be loaded',
      );
    }
  }
}
