import { FilterExecutor } from '@app/execution/application/executors/filter-executor';

const rows = [
  { name: 'Kiet', email: 'kiet@gmail.com', status: 'new' },
  { name: 'An', email: 'an@gmail.com', status: 'contacted' },
  { name: 'Minh', email: 'minh@gmail.com', status: 'new' },
];

describe('FilterExecutor', () => {
  const executor = new FilterExecutor();

  const run = async (config: Record<string, unknown>, input = rows) => {
    const parsed = executor.parseConfig(config);
    const kept: unknown[] = [];
    for (const json of input) {
      const result = await executor.executeItem({
        config: parsed,
        item: { json },
        credential: null,
      });
      if (result !== null) kept.push(result);
    }
    return kept;
  };

  it('runs once per item', () => {
    expect(executor.runMode).toBe('per_item');
  });

  it('keeps rows whose status equals new', async () => {
    expect(
      await run({ field: 'status', operator: 'equals', value: 'new' }),
    ).toEqual([
      { name: 'Kiet', email: 'kiet@gmail.com', status: 'new' },
      { name: 'Minh', email: 'minh@gmail.com', status: 'new' },
    ]);
  });

  it('keeps rows whose status does not equal new', async () => {
    expect(
      await run({ field: 'status', operator: 'not_equals', value: 'new' }),
    ).toEqual([{ name: 'An', email: 'an@gmail.com', status: 'contacted' }]);
  });

  it('keeps rows whose email contains an@', async () => {
    expect(
      await run({ field: 'email', operator: 'contains', value: 'an@' }),
    ).toEqual([{ name: 'An', email: 'an@gmail.com', status: 'contacted' }]);
  });

  it('reads nested fields with a dotted path', async () => {
    const input = [
      { id: 1, data: { label: 'urgent' } },
      { id: 2, data: { label: 'spam' } },
    ];
    expect(
      await run(
        { field: 'data.label', operator: 'equals', value: 'urgent' },
        input as never,
      ),
    ).toEqual([{ id: 1, data: { label: 'urgent' } }]);
  });

  it('reads fields whose name has spaces, as sheet headers often do', async () => {
    const input = [{ 'Full Name': 'An' }, { 'Full Name': 'Bo' }];
    expect(
      await run(
        { field: 'Full Name', operator: 'equals', value: 'An' },
        input as never,
      ),
    ).toEqual([{ 'Full Name': 'An' }]);
  });

  it('drops items that do not have the field', async () => {
    expect(
      await run({ field: 'missing', operator: 'equals', value: 'x' }),
    ).toEqual([]);
  });

  it('rejects an invalid config', () => {
    expect(() =>
      executor.parseConfig({ operator: 'equals', value: 'x' }),
    ).toThrow(/field/);
    expect(() =>
      executor.parseConfig({ field: 'a', operator: 'gt', value: 1 }),
    ).toThrow(/operator/);
    expect(() =>
      executor.parseConfig({ field: 'a', operator: 'equals' }),
    ).toThrow(/value/);
  });
});

