import { NodeCategory } from '../enums/node-category.enum';

export class NodeTypeDefinition {
  constructor(
    public readonly id: string,
    public readonly key: string,
    public readonly displayName: string,
    public readonly category: NodeCategory,
    public readonly configSchema: unknown,
    public readonly isActive: boolean,
    public readonly icon?: string | null,
    public readonly color?: string | null,
    public readonly description?: string | null,
    public readonly inputSchema?: unknown,
    public readonly outputSchema?: unknown,
    public readonly connectorId?: string | null,
    public readonly createdAt?: Date,
    public readonly updatedAt?: Date,
  ) {}
}
