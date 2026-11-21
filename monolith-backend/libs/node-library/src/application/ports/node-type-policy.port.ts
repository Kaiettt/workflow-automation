import {
  ChangeNodeTypeStatusParams,
  NodeTypePolicySnapshot,
} from '../../domain/node-type-policy';
export abstract class NodeTypePolicyPort {
  abstract isExecutionAllowed(key: string): Promise<boolean>;
  abstract changeStatus(
    params: ChangeNodeTypeStatusParams,
  ): Promise<NodeTypePolicySnapshot>;
}
