import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  ChangeConnectorPolicyCommand,
  ChangeConnectorPolicyHandler,
} from '@app/connector/application/commands/change-connector-policy.command';
import { InMemoryConnectorPolicyRepository } from '@test/support/connector/in-memory-connector-policy.repository';

describe('ChangeConnectorPolicyHandler', () => {
  let policyPort: InMemoryConnectorPolicyRepository;
  let handler: ChangeConnectorPolicyHandler;

  beforeEach(() => {
    policyPort = new InMemoryConnectorPolicyRepository();
    handler = new ChangeConnectorPolicyHandler(policyPort);
  });

  it('updates policy, bumps revision, and records audit event when revision matches (BDD-CM-02)', async () => {
    policyPort.setPolicy('c-slack', true, 1);

    const result = await handler.execute(
      new ChangeConnectorPolicyCommand({
        connectorId: 'c-slack',
        allowNewCredentials: false,
        reason: 'Tạm ngưng tích hợp Slack để audit bảo mật',
        expectedRevision: 1,
        adminId: 'admin-1',
      }),
    );

    expect(result.allowNewCredentials).toBe(false);
    expect(result.revision).toBe(2);
    expect(policyPort.auditEvents).toHaveLength(1);
    expect(policyPort.auditEvents[0]).toMatchObject({
      actorId: 'admin-1',
      action: 'CONNECTOR_POLICY_CHANGED',
      targetId: 'c-slack',
      reason: 'Tạm ngưng tích hợp Slack để audit bảo mật',
      before: { allowNewCredentials: true, revision: 1 },
      after: { allowNewCredentials: false, revision: 2 },
    });
  });

  it('rejects with STALE_REVISION when expectedRevision does not match (BDD-CM-03)', async () => {
    policyPort.setPolicy('c-google', false, 3);

    await expect(
      handler.execute(
        new ChangeConnectorPolicyCommand({
          connectorId: 'c-google',
          allowNewCredentials: true,
          reason: 'Bật lại tạo mới credential',
          expectedRevision: 2,
          adminId: 'admin-1',
        }),
      ),
    ).rejects.toThrow(ConflictException);

    try {
      await handler.execute(
        new ChangeConnectorPolicyCommand({
          connectorId: 'c-google',
          allowNewCredentials: true,
          reason: 'Bật lại tạo mới credential',
          expectedRevision: 2,
          adminId: 'admin-1',
        }),
      );
    } catch (error) {
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: 'STALE_REVISION',
      });
    }
    expect(policyPort.auditEvents).toHaveLength(0);
  });

  it('handles no-op without bumping revision or creating audit event (BDD-CM-04)', async () => {
    policyPort.setPolicy('c-google', false, 2);

    const result = await handler.execute(
      new ChangeConnectorPolicyCommand({
        connectorId: 'c-google',
        allowNewCredentials: false,
        reason: 'Gọi lại cùng giá trị',
        expectedRevision: 2,
        adminId: 'admin-1',
      }),
    );

    expect(result.allowNewCredentials).toBe(false);
    expect(result.revision).toBe(2);
    expect(policyPort.auditEvents).toHaveLength(0);
  });

  it('rejects when reason is shorter than 5 characters', async () => {
    policyPort.setPolicy('c-slack', true, 0);

    await expect(
      handler.execute(
        new ChangeConnectorPolicyCommand({
          connectorId: 'c-slack',
          allowNewCredentials: false,
          reason: '1234',
          expectedRevision: 0,
          adminId: 'admin-1',
        }),
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
