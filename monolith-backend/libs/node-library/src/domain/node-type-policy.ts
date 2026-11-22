export interface NodeTypePolicySnapshot {
  nodeTypeKey: string;
  isCatalogVisible: boolean;
  isExecutionAllowed: boolean;
  revision: number;
  updatedAt: Date;
}
export interface ChangeNodeTypeStatusParams {
  nodeTypeKey: string;
  isCatalogVisible?: boolean;
  isExecutionAllowed?: boolean;
  reason: string;
  expectedRevision: number;
  adminId: string;
}
export class NodeTypePolicyError extends Error {
  constructor(
    readonly code:
      'INVALID_NODE_TYPE_POLICY' | 'STALE_REVISION' | 'NODE_TYPE_NOT_FOUND',
    message: string,
  ) {
    super(message);
  }
}
export class NodeTypeDisabledError extends Error {
  readonly code = 'NODE_TYPE_DISABLED';
  constructor(key: string) {
    super(`Node type ${key} is disabled by the platform administrator`);
  }
}
export function planNodeTypeStatusChange(
  current: NodeTypePolicySnapshot,
  params: ChangeNodeTypeStatusParams,
) {
  const reason = typeof params.reason === 'string' ? params.reason.trim() : '';
  const flags = [params.isCatalogVisible, params.isExecutionAllowed];
  if (
    reason.length < 5 ||
    reason.length > 500 ||
    !Number.isInteger(params.expectedRevision) ||
    params.expectedRevision < 0 ||
    flags.every((flag) => flag === undefined) ||
    flags.some((flag) => flag !== undefined && typeof flag !== 'boolean')
  ) {
    throw new NodeTypePolicyError(
      'INVALID_NODE_TYPE_POLICY',
      'Provide at least one boolean flag, a nonnegative integer revision and a reason of 5–500 characters',
    );
  }
  if (current.revision !== params.expectedRevision)
    throw new NodeTypePolicyError(
      'STALE_REVISION',
      'Policy changed; reload before continuing',
    );
  const isCatalogVisible = params.isCatalogVisible ?? current.isCatalogVisible;
  const isExecutionAllowed =
    params.isExecutionAllowed ?? current.isExecutionAllowed;
  const changed =
    isCatalogVisible !== current.isCatalogVisible ||
    isExecutionAllowed !== current.isExecutionAllowed;
  return {
    ...current,
    isCatalogVisible,
    isExecutionAllowed,
    revision: current.revision + (changed ? 1 : 0),
    changed,
    reason: params.reason.trim(),
  };
}
