import { describe, expect, it } from 'vitest';
import { hasNamedOutputs, outputOfHandle, resolveOutputs } from './node-outputs';

describe('resolveOutputs', () => {
  it('gives a node without x-outputs the single main output', () => {
    const outputs = resolveOutputs({ type: 'object' }, {});
    expect(outputs.map((o) => o.key)).toEqual(['main']);
    expect(hasNamedOutputs(outputs)).toBe(false);
  });

  it('lists static outputs', () => {
    const outputs = resolveOutputs(
      { 'x-outputs': { static: [{ key: 'true', label: 'True' }, { key: 'false', label: 'False' }] } },
      {},
    );
    expect(outputs.map((o) => o.label)).toEqual(['True', 'False']);
    expect(hasNamedOutputs(outputs)).toBe(true);
  });

  it('builds one output per rule plus the fallback', () => {
    const outputs = resolveOutputs(
      { 'x-outputs': { fromConfig: 'rules', labelField: 'label', fallback: true } },
      { rules: [{ label: 'Price' }, {}] },
    );
    expect(outputs).toEqual([
      { key: 'rule_0', label: 'Price' },
      { key: 'rule_1', label: 'Rule 2' },
      { key: 'fallback', label: 'Fallback' },
    ]);
  });

  it('names a rule output after its id so reordering keeps the connections', () => {
    const schema = { 'x-outputs': { fromConfig: 'rules', fallback: false } };
    expect(resolveOutputs(schema, { rules: [{ id: 'b' }, { id: 'a' }] }).map((o) => o.key)).toEqual([
      'rule_b',
      'rule_a',
    ]);
  });
});

describe('outputOfHandle', () => {
  it('reads the output key from an out:<key> handle', () => {
    expect(outputOfHandle('out:true')).toBe('true');
    expect(outputOfHandle('right-source')).toBeNull();
    expect(outputOfHandle(undefined)).toBeNull();
  });
});
