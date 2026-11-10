/* eslint-disable @typescript-eslint/unbound-method */
import { BadRequestException } from '@nestjs/common';
import { NodeConfigResolver } from '@app/execution/application/services/node-config-resolver';
import { ExecutionRepository } from '@app/execution/domain/repositories/execution.repository';
import { INodeExecutor } from '@app/execution/domain/entities/node-executor';

describe('NodeConfigResolver', () => {
  let repository: jest.Mocked<ExecutionRepository>;
  let resolver: NodeConfigResolver;

  beforeEach(() => {
    repository = {
      resolveCredential: jest.fn(),
      saveNodeLog: jest.fn(),
      createExecution: jest.fn(),
      findExecution: jest.fn(),
      findVersion: jest.fn(),
      finishExecution: jest.fn(),
      failStaleExecutions: jest.fn(),
    } as unknown as jest.Mocked<ExecutionRepository>;

    resolver = new NodeConfigResolver(repository);
  });

  describe('applyDefaults', () => {
    it('applies schema default properties to empty config', () => {
      const schema = {
        type: 'object',
        properties: {
          retries: { type: 'number', default: 3 },
          timeout: { type: 'number', default: 5000 },
        },
      };

      const result = resolver.applyDefaults({}, schema);
      expect(result).toEqual({ retries: 3, timeout: 5000 });
    });

    it('preserves existing values over schema defaults', () => {
      const schema = {
        type: 'object',
        properties: {
          retries: { type: 'number', default: 3 },
        },
      };

      const result = resolver.applyDefaults({ retries: 5 }, schema);
      expect(result).toEqual({ retries: 5 });
    });
  });

  describe('resolveCredential', () => {
    const mockExecutor: INodeExecutor = {
      key: 'test.executor',
      runMode: 'once',
      parseConfig: jest.fn((c) => c),
      execute: jest.fn(),
      expectedConnectorKey: () => 'google-sheets',
    };

    it('returns null when credential_id is undefined', async () => {
      const secret = await resolver.resolveCredential(
        mockExecutor,
        {},
        'owner-1',
      );
      expect(secret).toBeNull();
      expect(repository.resolveCredential).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when credential_id format is not UUID', async () => {
      await expect(
        resolver.resolveCredential(
          mockExecutor,
          { credential_id: 'not-a-uuid' },
          'owner-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws Error when credential is not found in repository', async () => {
      repository.resolveCredential.mockResolvedValue(null);
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';

      await expect(
        resolver.resolveCredential(
          mockExecutor,
          { credential_id: validUuid },
          'owner-1',
        ),
      ).rejects.toThrow('credential was not found');
    });

    it('throws Error when credential belongs to a different connector', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      repository.resolveCredential.mockResolvedValue({
        id: validUuid,
        connectorKey: 'gmail', // does not match 'google-sheets'
        secret: { token: 'xyz' },
      });

      await expect(
        resolver.resolveCredential(
          mockExecutor,
          { credential_id: validUuid },
          'owner-1',
        ),
      ).rejects.toThrow(
        'Credential does not belong to the "google-sheets" connector',
      );
    });

    it('returns decrypted secret when credential matches connector', async () => {
      const validUuid = '123e4567-e89b-12d3-a456-426614174000';
      repository.resolveCredential.mockResolvedValue({
        id: validUuid,
        connectorKey: 'google-sheets',
        secret: { token: 'valid-secret-token' },
      });

      const secret = await resolver.resolveCredential(
        mockExecutor,
        { credential_id: validUuid },
        'owner-1',
      );

      expect(secret).toEqual({ token: 'valid-secret-token' });
    });
  });

  describe('resolveItemConfig', () => {
    it('interpolates template expression and calls parseConfig', () => {
      const mockExecutor: INodeExecutor = {
        key: 'test.executor',
        runMode: 'per_item',
        parseConfig: jest.fn((cfg: unknown) => ({
          parsed: true,
          ...(cfg as object),
        })),
      };

      const schema = {
        type: 'object',
        properties: {
          greeting: { type: 'string', 'x-allowExpression': true },
        },
      };

      const result = resolver.resolveItemConfig(
        mockExecutor,
        { greeting: 'Hello {{$json.name}}!' },
        schema,
        {
          runs: [],
          names: new Map(),
          currentItem: { json: { name: 'Alice' } },
          currentIndex: 0,
        },
      );

      expect(result).toEqual({
        parsed: true,
        greeting: 'Hello Alice!',
      });
      expect(mockExecutor.parseConfig).toHaveBeenCalled();
    });
  });
});
