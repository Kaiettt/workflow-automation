import { IfExecutor } from '@app/execution/application/executors/if-executor';
import { SwitchExecutor } from '@app/execution/application/executors/switch-executor';
import { SetFieldsExecutor } from '@app/execution/application/executors/set-fields-executor';
import { RoutedItem } from '@app/execution/domain/models/item';

const item = (json: Record<string, unknown>) => ({ json });
const cond = (value1: unknown, operator: string, value2?: unknown) => ({
  value1,
  operator,
  value2,
});

describe('IfExecutor', () => {
  const executor = new IfExecutor();
  const run = async (config: unknown, json: Record<string, unknown>) => {
    const routed = await executor.executeItem({
      config: executor.parseConfig(config),
      item: item(json),
      credential: null,
    });
    return [routed.output, routed.json];
  };

  it('sends a matching item to "true" and keeps its data', async () => {
    expect(
      await run(
        { conditions: [cond('Giá bao nhiêu', 'contains', 'gia')] },
        { text: 'x' },
      ),
    ).toEqual(['true', { text: 'x' }]);
  });

  it('sends a non-matching item to "false"', async () => {
    expect(
      (await run({ conditions: [cond('hi', 'contains', 'gia')] }, {}))[0],
    ).toBe('false');
  });

  it('combines conditions with and / or', async () => {
    const conditions = [cond('a', 'equals', 'a'), cond('a', 'equals', 'b')];
    expect((await run({ conditions }, {}))[0]).toBe('false');
    expect((await run({ conditions, combine: 'or' }, {}))[0]).toBe('true');
  });

  it('is case sensitive when asked', async () => {
    const conditions = [cond('Hi', 'equals', 'hi')];
    expect((await run({ conditions }, {}))[0]).toBe('true');
    expect((await run({ conditions, ignore_case: false }, {}))[0]).toBe(
      'false',
    );
  });

  it('requires at least one condition', () => {
    expect(() => executor.parseConfig({ conditions: [] })).toThrow(
      /at least one condition/,
    );
    expect(() => executor.parseConfig({})).toThrow();
  });

  it('rejects an unknown operator', () => {
    expect(() =>
      executor.parseConfig({ conditions: [cond('a', 'nope', 'a')] }),
    ).toThrow();
  });
});

describe('SwitchExecutor', () => {
  const executor = new SwitchExecutor();
  const rules = [
    { id: 'p', label: 'Price', conditions: [cond('{t}', 'contains', 'gia')] },
    {
      id: 'h',
      label: 'Human',
      conditions: [cond('{t}', 'contains', 'nhan vien')],
    },
  ];
  const outputsFor = async (
    text: string,
    extra: Record<string, unknown> = {},
  ) => {
    const withText = rules.map((rule) => ({
      ...rule,
      conditions: rule.conditions.map((c) => ({ ...c, value1: text })),
    }));
    const routed = await executor.executeItem({
      config: executor.parseConfig({ rules: withText, ...extra }),
      item: item({ text }),
      credential: null,
    });
    return routed.map((entry: RoutedItem) => entry.output);
  };

  it('sends an item to the output named after the rule id', async () => {
    expect(await outputsFor('Bảng giá?')).toEqual(['rule_p']);
    expect(await outputsFor('Gặp nhân viên')).toEqual(['rule_h']);
  });

  it('sends an item that matches no rule to the fallback', async () => {
    expect(await outputsFor('xin chào')).toEqual(['fallback']);
  });

  it('stops at the first match by default and sends to every match in "all" mode', async () => {
    expect(await outputsFor('giá và nhân viên')).toEqual(['rule_p']);
    expect(await outputsFor('giá và nhân viên', { mode: 'all' })).toEqual([
      'rule_p',
      'rule_h',
    ]);
  });

  it('names an output by position when the rule has no id', async () => {
    const routed = await executor.executeItem({
      config: executor.parseConfig({
        rules: [{ conditions: [cond('a', 'equals', 'a')] }],
      }),
      item: item({}),
      credential: null,
    });
    expect(routed.map((entry) => entry.output)).toEqual(['rule_0']);
  });

  it('requires a rule with a condition', () => {
    expect(() => executor.parseConfig({ rules: [] })).toThrow(
      /at least one rule/,
    );
    expect(() => executor.parseConfig({ rules: [{ conditions: [] }] })).toThrow(
      /at least one condition/,
    );
  });
});

describe('SetFieldsExecutor', () => {
  const executor = new SetFieldsExecutor();
  const run = (config: unknown, json: Record<string, unknown>) =>
    executor.executeItem({
      config: executor.parseConfig(config),
      item: item(json),
      credential: null,
    });

  it('adds fields and keeps the others', async () => {
    expect(
      await run(
        { fields: [{ name: 'reply', value: 'Hello' }] },
        { text: 'hi' },
      ),
    ).toEqual({ text: 'hi', reply: 'Hello' });
  });

  it('drops the other fields when asked', async () => {
    expect(
      await run(
        {
          fields: [{ name: 'reply', value: 'Hello' }],
          keep_other_fields: false,
        },
        { text: 'hi' },
      ),
    ).toEqual({ reply: 'Hello' });
  });

  it('writes a dotted path and overwrites an existing value', async () => {
    expect(
      await run(
        {
          fields: [
            { name: 'customer.name', value: 'An' },
            { name: 'text', value: 'bye' },
          ],
        },
        { text: 'hi', customer: { id: 7 } },
      ),
    ).toEqual({ text: 'bye', customer: { id: 7, name: 'An' } });
  });

  it('keeps the type of the value and does not change the input item', async () => {
    const json = { n: 1 };
    const out = await run({ fields: [{ name: 'list', value: [1, 2] }] }, json);
    expect(out).toEqual({ n: 1, list: [1, 2] });
    expect(json).toEqual({ n: 1 });
  });

  it('refuses names that could change prototypes', () => {
    expect(() =>
      run({ fields: [{ name: '__proto__.x', value: 1 }] }, {}),
    ).toThrow(/not a valid field name/);
    expect(() => run({ fields: [{ name: 'a..b', value: 1 }] }, {})).toThrow(
      /not a valid field name/,
    );
  });

  it('requires a name for every field', () => {
    expect(() =>
      executor.parseConfig({ fields: [{ name: ' ', value: 1 }] }),
    ).toThrow(/needs a name/);
  });
});
