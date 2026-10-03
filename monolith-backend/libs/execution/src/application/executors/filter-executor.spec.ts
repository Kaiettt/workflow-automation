import { FilterExecutor } from './filter-executor';

const rows = [
  { name: 'Kiet', email: 'kiet@gmail.com', status: 'new' },
  { name: 'An', email: 'an@gmail.com', status: 'contacted' },
  { name: 'Minh', email: 'minh@gmail.com', status: 'new' },
];

describe('FilterExecutor', () => {
  const executor = new FilterExecutor();

  it('keeps rows whose status equals new', async () => {
    const output = await executor.execute({
      config: { field: 'status', operator: 'equals', value: 'new' },
      input: rows,
      credential: null,
    });

    expect(output).toEqual([
      { name: 'Kiet', email: 'kiet@gmail.com', status: 'new' },
      { name: 'Minh', email: 'minh@gmail.com', status: 'new' },
    ]);
  });

  it('keeps rows whose status does not equal new', async () => {
    const output = await executor.execute({
      config: { field: 'status', operator: 'not_equals', value: 'new' },
      input: rows,
      credential: null,
    });

    expect(output).toEqual([
      { name: 'An', email: 'an@gmail.com', status: 'contacted' },
    ]);
  });

  it('keeps rows whose email contains an@', async () => {
    const output = await executor.execute({
      config: { field: 'email', operator: 'contains', value: 'an@' },
      input: rows,
      credential: null,
    });

    expect(output).toEqual([
      { name: 'An', email: 'an@gmail.com', status: 'contacted' },
    ]);
  });
});
