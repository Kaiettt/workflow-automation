import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigField } from './ConfigField';

afterEach(cleanup);

const CONDITION_ITEM = {
  type: 'object',
  'x-propertyOrder': ['value1', 'operator', 'value2'],
  properties: {
    value1: { type: 'string', title: 'Value', 'x-allowExpression': true },
    operator: {
      type: 'string',
      default: 'contains',
      enum: ['contains', 'is_empty'],
    },
    value2: {
      type: 'string',
      title: 'Compare to',
      'x-allowExpression': true,
      'x-hideWhen': { field: 'operator', in: ['is_empty'] },
    },
  },
};
const RULES = {
  type: 'array',
  title: 'Rules',
  items: {
    type: 'object',
    'x-rowId': true,
    properties: { label: { type: 'string', title: 'Output name' } },
  },
};

function renderField(schema: Record<string, unknown>, value: unknown, onChange = vi.fn()) {
  render(
    <ConfigField
      nodeKey="logic.if"
      fieldKey="items"
      schema={schema}
      config={{ items: value }}
      onChange={onChange}
      onConnectOAuth={() => undefined}
    />,
  );
  return onChange;
}

describe('ListField', () => {
  it('adds a row built from the defaults of its fields', () => {
    const onChange = renderField({ type: 'array', title: 'Conditions', items: CONDITION_ITEM }, []);
    fireEvent.click(screen.getByRole('button', { name: /add condition/i }));
    expect(onChange).toHaveBeenCalledWith('items', [{ operator: 'contains' }]);
  });

  it('gives each new row an id when the rows ask for one', () => {
    const onChange = renderField(RULES, []);
    fireEvent.click(screen.getByRole('button', { name: /add rule/i }));
    const [, rows] = onChange.mock.calls[0] as [string, Array<{ id: string }>];
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toMatch(/^[a-z0-9]+$/);
  });

  it('edits one field of one row and keeps the others', () => {
    const rows = [{ operator: 'contains', value1: 'a' }, { operator: 'contains', value1: 'b' }];
    const onChange = renderField({ type: 'array', title: 'Conditions', items: CONDITION_ITEM }, rows);
    const inputs = screen.getAllByLabelText('Value');
    fireEvent.change(inputs[1], { target: { value: 'changed' } });
    expect(onChange).toHaveBeenCalledWith('items', [rows[0], { operator: 'contains', value1: 'changed' }]);
  });

  it('removes a row', () => {
    const rows = [{ label: 'A', id: 'a' }, { label: 'B', id: 'b' }];
    const onChange = renderField(RULES, rows);
    fireEvent.click(screen.getAllByRole('button', { name: /remove rule/i })[0]);
    expect(onChange).toHaveBeenCalledWith('items', [rows[1]]);
  });

  it('hides the comparison value for an "is empty" condition', () => {
    renderField(
      { type: 'array', title: 'Conditions', items: CONDITION_ITEM },
      [{ operator: 'is_empty', value1: '' }],
    );
    expect(screen.queryByLabelText('Compare to')).toBeNull();
  });
});
