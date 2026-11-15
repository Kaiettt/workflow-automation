/* eslint-disable @typescript-eslint/unbound-method */
import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { AdminController } from '@app/admin/presentation/admin.controller';
import { AdminMutationFieldsGuard } from '@app/admin/presentation/admin-mutation-fields.guard';
import { ChangeConnectorPolicyCommand } from '@app/connector/application/commands/change-connector-policy.command';
import { AdminReadQuery } from '@app/admin/application/admin-read.query';
import { Reflector } from '@nestjs/core';

describe('Admin Connectors API (Slice 5 & 6)', () => {
  let controller: AdminController;
  let queries: jest.Mocked<QueryBus>;
  let commands: jest.Mocked<CommandBus>;

  beforeEach(() => {
    queries = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<QueryBus>;

    commands = {
      execute: jest.fn(),
    } as unknown as jest.Mocked<CommandBus>;

    controller = new AdminController(queries, commands);
  });

  describe('GET /api/admin/connectors', () => {
    it('executes AdminReadQuery with parsed filters (BDD-CM-01)', async () => {
      queries.execute.mockResolvedValueOnce({
        items: [
          {
            id: 'c1',
            key: 'google',
            name: 'Google',
            authType: 'OAUTH2',
            isActive: true,
            allowNewCredentials: true,
            revision: 0,
            credentialCount: 5,
            workflowCount: 2,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      });

      const res = await controller.connectors({
        page: 1,
        pageSize: 20,
        q: 'google',
        authType: 'OAUTH2',
        isActive: 'true',
        allowNewCredentials: 'true',
      });

      expect(res.success).toBe(true);
      expect(queries.execute).toHaveBeenCalledWith(
        new AdminReadQuery({
          kind: 'connectors',
          filter: {
            page: 1,
            pageSize: 20,
            q: 'google',
            authType: 'OAUTH2',
            isActive: true,
            allowNewCredentials: true,
          },
        }),
      );
      const data = res.data as { items: Array<{ key: string }> };
      expect(data.items[0]?.key).toBe('google');
    });
  });

  describe('GET /api/admin/connectors/:id', () => {
    it('fetches single connector detail by ID (BDD-CM-01)', async () => {
      queries.execute.mockResolvedValueOnce({
        id: 'c1',
        key: 'google',
        name: 'Google',
        nodeTypes: [{ id: 'n1', key: 'google.gmail.send' }],
      });

      const res = await controller.connector('c1');
      expect(res.success).toBe(true);
      expect(queries.execute).toHaveBeenCalledWith(
        new AdminReadQuery({ kind: 'connector', id: 'c1' }),
      );
    });
  });

  describe('PATCH /api/admin/connectors/:id/credential-policy', () => {
    it('dispatches ChangeConnectorPolicyCommand with actor ID (BDD-CM-02)', async () => {
      commands.execute.mockResolvedValueOnce({
        connectorId: 'c1',
        allowNewCredentials: false,
        revision: 2,
        updatedAt: new Date(),
      });

      const res = await controller.credentialPolicy(
        'c1',
        {
          allowNewCredentials: false,
          reason: 'Bảo trì connector',
          expectedRevision: 1,
        },
        { id: 'admin-99', email: 'admin@flow.test', role: 'ADMIN' },
      );

      expect(res.success).toBe(true);
      expect(commands.execute).toHaveBeenCalledWith(
        new ChangeConnectorPolicyCommand({
          connectorId: 'c1',
          allowNewCredentials: false,
          reason: 'Bảo trì connector',
          expectedRevision: 1,
          adminId: 'admin-99',
        }),
      );
      const data = res.data as { allowNewCredentials: boolean };
      expect(data.allowNewCredentials).toBe(false);
    });
  });

  describe('AdminMutationFieldsGuard for credential-policy', () => {
    it('allows valid body fields: expectedRevision, reason, allowNewCredentials', () => {
      const reflector = new Reflector();
      jest
        .spyOn(reflector, 'get')
        .mockReturnValue(['expectedRevision', 'reason', 'allowNewCredentials']);
      const guard = new AdminMutationFieldsGuard(reflector);

      const context = {
        getHandler: () => {},
        switchToHttp: () => ({
          getRequest: () => ({
            body: {
              expectedRevision: 1,
              reason: 'Bảo trì',
              allowNewCredentials: false,
            },
          }),
        }),
      } as unknown as ExecutionContext;

      expect(guard.canActivate(context)).toBe(true);
    });

    it('rejects unsupported fields in policy mutation', () => {
      const reflector = new Reflector();
      jest
        .spyOn(reflector, 'get')
        .mockReturnValue(['expectedRevision', 'reason', 'allowNewCredentials']);
      const guard = new AdminMutationFieldsGuard(reflector);

      const context = {
        getHandler: () => {},
        switchToHttp: () => ({
          getRequest: () => ({
            body: {
              expectedRevision: 1,
              reason: 'Bảo trì',
              allowNewCredentials: false,
              unexpectedField: 'malicious',
            },
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(context)).toThrow(BadRequestException);
    });
  });
});
