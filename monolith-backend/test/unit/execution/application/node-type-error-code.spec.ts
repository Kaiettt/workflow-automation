import { safeExecutionErrorCode } from '@app/execution/application/execution-error-code';

describe('Node type runtime error code (BDD-NM-03)', () => {
  it('preserves the platform-owned disabled code while rejecting arbitrary codes', () => {
    expect(safeExecutionErrorCode('NODE_TYPE_DISABLED')).toBe(
      'NODE_TYPE_DISABLED',
    );
    expect(safeExecutionErrorCode('CLIENT_PAYLOAD')).toBe('UNCLASSIFIED_ERROR');
  });
});
