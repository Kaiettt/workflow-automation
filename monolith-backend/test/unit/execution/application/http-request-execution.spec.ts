import { nodeConfigSchema, PackageRegistry } from '@app/apps';
import { createHttpPackage } from '@app/apps/http/http.package';
import { webhookPackage } from '@app/apps/webhook/webhook.package';
import { SafeRequest } from '@app/apps/http/safe-request';
import { WorkflowEngine } from '@app/execution/application/services/workflow-engine';
import { NodeCatalogPort } from '@app/execution/application/ports/node-catalog.port';
import { packageExecutors } from '@app/execution/application/executors/package-action-executor';
import {
  ExecutionStatus,
  TriggerType,
} from '@app/execution/domain/constants/execution.constants';
import type { ResolvedCredential } from '@app/execution/domain/models/execution.types';
import {
  chain,
  CREDENTIAL_ID,
  MemoryExecutionRepository,
} from '@test/support/execution/start-execution.test-support';

class HttpRepository extends MemoryExecutionRepository {
  lookups = 0;
  constructor(
    version: ConstructorParameters<typeof MemoryExecutionRepository>[0],
    private readonly connectorKeyOfCredential: string,
  ) {
    super(version);
  }
  resolveCredential(
    credentialId: string,
    ownerId: string,
  ): Promise<ResolvedCredential> {
    this.lookups += 1;
    return ownerId === 'actor-1' && credentialId === CREDENTIAL_ID
      ? Promise.resolve({
          connectorKey: this.connectorKeyOfCredential,
          secret: { token: 'tok-9' },
        })
      : Promise.reject(new Error('credential was not found'));
  }
}

const hook = {
  id: 'hook',
  data: { key: 'webhook.trigger', name: 'Incoming', config: {} },
};
const httpNode = (config: Record<string, unknown>) => ({
  id: 'call',
  data: { key: 'http.request', name: 'Call API', config },
});

async function run(
  config: Record<string, unknown>,
  credentialConnector = 'httpBearerAuth',
) {
  const calls: SafeRequest[] = [];
  const registry = new PackageRegistry([
    webhookPackage,
    createHttpPackage({
      allowPrivate: () => false,
      request: (request) => {
        calls.push(request);
        return Promise.resolve({
          status: 200,
          headers: { 'content-type': 'application/json' },
          body: Buffer.from('{"state":"shipped"}'),
          url: request.url,
        });
      },
    }),
  ]);
  const catalog = new (class extends NodeCatalogPort {
    getConfigSchemas() {
      return Promise.resolve(
        new Map(registry.allNodes().map((n) => [n.key, nodeConfigSchema(n)])),
      );
    }
  })();
  const definition = chain([hook, httpNode(config)]);
  const version = {
    id: 'version-1',
    workflowId: 'workflow-1',
    workflowOwnerId: 'actor-1',
    definition,
  };
  const repository = new HttpRepository(version, credentialConnector);
  const engine = new WorkflowEngine(
    repository,
    packageExecutors(registry),
    catalog,
  );
  const items = [{ json: { body: { order_id: 'A-5' } } }];
  const startedAt = new Date();
  const id = await engine.createExecution(
    {
      version,
      triggerType: TriggerType.WEBHOOK,
      triggeredById: null,
      triggerItems: items,
    },
    startedAt,
  );
  const status = await engine.run(id, version, items, startedAt);
  return {
    status,
    calls,
    repository,
    log: repository.logs.find((l) => l.nodeId === 'call')!,
  };
}

describe('HTTP Request node in a workflow', () => {
  it('fills the URL and a header from the item and calls with the credential', async () => {
    const { status, calls, log } = await run({
      url: 'https://api.test/orders/{{$json.body.order_id}}',
      authentication: 'httpBearerAuth',
      credential_id: CREDENTIAL_ID,
      headers: [{ name: 'X-Order', value: '{{$json.body.order_id}}' }],
    });

    expect(status).toBe(ExecutionStatus.SUCCESS);
    expect(calls[0].url).toBe('https://api.test/orders/A-5');
    expect(calls[0].headers).toEqual({
      'x-order': 'A-5',
      authorization: 'Bearer tok-9',
    });
    expect((log.output as Array<{ json: unknown }>)[0].json).toMatchObject({
      status: 200,
      ok: true,
      body: { state: 'shipped' },
    });
  });

  it('needs no credential without authentication', async () => {
    const { status, calls, repository } = await run({
      url: 'https://api.test/public',
    });
    expect(status).toBe(ExecutionStatus.SUCCESS);
    expect(calls[0].headers).toEqual({});
    expect(repository.lookups).toBe(0);
  });

  it('rejects a credential of another type than the chosen authentication', async () => {
    const { status, calls, log } = await run(
      {
        url: 'https://api.test/orders',
        authentication: 'httpBearerAuth',
        credential_id: CREDENTIAL_ID,
      },
      'httpBasicAuth',
    );
    expect(status).toBe(ExecutionStatus.FAILED);
    expect(log.errorMessage).toBe(
      'Credential does not belong to the "httpBearerAuth" connector',
    );
    expect(calls).toHaveLength(0);
  });

  it('asks for a credential when an authentication is chosen without one', async () => {
    const { status, log } = await run({
      url: 'https://api.test/orders',
      authentication: 'httpBearerAuth',
    });
    expect(status).toBe(ExecutionStatus.FAILED);
    expect(log.errorMessage).toBe('Choose a credential for this node');
  });

  it('fails the node with the reason when the URL expression is wrong', async () => {
    const { status, log } = await run({
      url: 'https://api.test/{{$node["Nope"].json.x}}',
    });
    expect(status).toBe(ExecutionStatus.FAILED);
    expect(log.errorMessage).toContain('Config "url"');
  });
});
