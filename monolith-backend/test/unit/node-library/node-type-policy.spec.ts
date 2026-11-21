import {
  NodeTypePolicyError,
  planNodeTypeStatusChange,
} from '@app/node-library/domain/node-type-policy';

const current = {
  nodeTypeKey: 'logic.if',
  isCatalogVisible: true,
  isExecutionAllowed: true,
  revision: 0,
  updatedAt: new Date('2026-11-22T00:00:00Z'),
};
const params = {
  nodeTypeKey: current.nodeTypeKey,
  adminId: 'admin',
  expectedRevision: 0,
  reason: '  Maintenance window  ',
  isCatalogVisible: false,
};
describe('Node type policy decisions', () => {
  it.each([
    { reason: '   ' },
    { reason: 'x'.repeat(501) },
    { expectedRevision: -1 },
    { expectedRevision: 0.5 },
    { isCatalogVisible: undefined },
  ])('rejects invalid mutation input (BDD-NM-09): %j', (change) => {
    expect(() =>
      planNodeTypeStatusChange(current, { ...params, ...change }),
    ).toThrow(NodeTypePolicyError);
  });
  it('changes visibility while preserving execution permission (BDD-NM-05)', () => {
    expect(planNodeTypeStatusChange(current, params)).toMatchObject({
      isCatalogVisible: false,
      isExecutionAllowed: true,
      revision: 1,
      changed: true,
      reason: 'Maintenance window',
    });
  });
  it('rejects stale requests even when the requested flags match (BDD-NM-06)', () => {
    expect(() =>
      planNodeTypeStatusChange(
        { ...current, revision: 1 },
        { ...params, isCatalogVisible: true },
      ),
    ).toThrow(NodeTypePolicyError);
  });
  it('returns unchanged policy for a current no-op (BDD-NM-07)', () => {
    expect(
      planNodeTypeStatusChange(current, { ...params, isCatalogVisible: true }),
    ).toMatchObject({ revision: 0, changed: false });
  });
});
