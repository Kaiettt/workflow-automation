import { PackageCatalogSync } from '@app/node-library/infrastructure/package-catalog.sync';
import { PackageRegistry } from '@app/apps';
import { FakeMetaGraph } from '@test/support/apps/fake-meta-graph';
import { createMessengerPackage } from '@app/apps/messenger/messenger.package';
import type { PrismaService } from '@app/database';

describe('PackageCatalogSync isolation (BDD-CM-09)', () => {
  let syncService: PackageCatalogSync;
  let connectorUpsert: jest.Mock;
  let nodeTypeUpsert: jest.Mock;
  let policyUpsert: jest.Mock;
  let policyUpdate: jest.Mock;
  let policyDelete: jest.Mock;
  let policyCreate: jest.Mock;
  let registry: PackageRegistry;

  beforeEach(() => {
    connectorUpsert = jest.fn().mockResolvedValue({ id: 'conn-1' });
    nodeTypeUpsert = jest.fn().mockResolvedValue({ id: 'node-1' });
    policyUpsert = jest.fn();
    policyUpdate = jest.fn();
    policyDelete = jest.fn();
    policyCreate = jest.fn();

    const mockPrisma = {
      connector: { upsert: connectorUpsert },
      nodeTypeDefinition: { upsert: nodeTypeUpsert },
      connectorPolicy: {
        upsert: policyUpsert,
        update: policyUpdate,
        delete: policyDelete,
        create: policyCreate,
      },
    } as unknown as PrismaService;

    registry = new PackageRegistry([
      createMessengerPackage(new FakeMetaGraph()),
    ]);
    syncService = new PackageCatalogSync(mockPrisma, registry);
  });

  it('upserts connectors and node definitions without touching connector_policies (BDD-CM-09)', async () => {
    await syncService.sync();

    expect(connectorUpsert).toHaveBeenCalled();
    expect(nodeTypeUpsert).toHaveBeenCalled();

    // Verify connector_policies is completely untouched
    expect(policyUpsert).not.toHaveBeenCalled();
    expect(policyUpdate).not.toHaveBeenCalled();
    expect(policyDelete).not.toHaveBeenCalled();
    expect(policyCreate).not.toHaveBeenCalled();
  });
});
