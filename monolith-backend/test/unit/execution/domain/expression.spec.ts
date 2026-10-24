import { ExpressionSyntaxError } from '@app/execution/domain/expression/errors';
import { parseExpression } from '@app/execution/domain/expression/parser';
import { readField } from '@app/execution/domain/expression/path';
import {
  applySchemaDefaults,
  resolveConfig,
} from '@app/execution/domain/expression/resolve-config';
import {
  evaluateTemplate,
  ExpressionContext,
  parseTemplate,
} from '@app/execution/domain/expression/template';

const ctx = (json: Record<string, unknown>): ExpressionContext => ({
  currentItem: { json },
  getNodeAll: () => [],
  getPairedJson: () => ({}),
});

const evaluate = (template: string, json: Record<string, unknown>): unknown =>
  evaluateTemplate(parseTemplate(template), ctx(json));

describe('parseExpression', () => {
  it.each([
    ['$json.name', { root: 'json', path: [{ kind: 'key', name: 'name' }] }],
    [
      '$json.a.b[0]',
      {
        root: 'json',
        path: [
          { kind: 'key', name: 'a' },
          { kind: 'key', name: 'b' },
          { kind: 'index', index: 0 },
        ],
      },
    ],
    [
      '$json["full name"]',
      { root: 'json', path: [{ kind: 'key', name: 'full name' }] },
    ],
    ['$json', { root: 'json', path: [] }],
    ['  name  ', { root: 'json', path: [{ kind: 'key', name: 'name' }] }],
    [
      '$node["Read Customers"].json.email',
      {
        root: 'node',
        nodeName: 'Read Customers',
        access: 'json',
        path: [{ kind: 'key', name: 'email' }],
      },
    ],
    [
      "$node['Sheet'].all[0].id",
      {
        root: 'node',
        nodeName: 'Sheet',
        access: 'all',
        path: [
          { kind: 'index', index: 0 },
          { kind: 'key', name: 'id' },
        ],
      },
    ],
  ])('parses %s', (source, expected) => {
    expect(parseExpression(source)).toEqual(expected);
  });

  it.each([
    '$json.',
    '$json..a',
    '$json[abc]',
    '$json[0',
    '$node.json',
    '$node["X"].items',
    '$node["X"',
    '$foo',
    '1 + 1',
    'a b',
    '',
  ])('rejects %p', (source) => {
    expect(() => parseExpression(source)).toThrow(ExpressionSyntaxError);
  });
});

describe('evaluateTemplate', () => {
  const json = {
    name: 'An',
    amount: 5000000,
    paid: false,
    tags: ['a', 'b'],
    customer: { city: 'Hue' },
    nothing: null,
  };

  it('keeps the type when the field is a single expression', () => {
    expect(evaluate('{{$json.amount}}', json)).toBe(5000000);
    expect(evaluate('{{$json.paid}}', json)).toBe(false);
    expect(evaluate('{{$json.tags}}', json)).toEqual(['a', 'b']);
    expect(evaluate('{{$json.customer}}', json)).toEqual({ city: 'Hue' });
  });

  it('returns null for a single expression that does not exist', () => {
    expect(evaluate('{{$json.missing}}', json)).toBeNull();
    expect(evaluate('{{$json.nothing}}', json)).toBeNull();
  });

  it('concatenates into a string when mixed with text', () => {
    expect(evaluate('Hello {{$json.name}}!', json)).toBe('Hello An!');
    expect(evaluate('No: {{$json.amount}}d', json)).toBe('No: 5000000d');
    expect(evaluate('{{$json.name}}{{$json.amount}}', json)).toBe('An5000000');
  });

  it('serialises objects and renders missing values as empty text', () => {
    expect(evaluate('c={{$json.customer}}', json)).toBe('c={"city":"Hue"}');
    expect(evaluate('x={{$json.missing}}.', json)).toBe('x=.');
    expect(evaluate('x={{$json.nothing}}.', json)).toBe('x=.');
  });

  it('supports the legacy bare name and spaces inside braces', () => {
    expect(evaluate('Welcome, {{name}}!', json)).toBe('Welcome, An!');
    expect(evaluate('Welcome, {{ name }}!', json)).toBe('Welcome, An!');
  });

  it('reads nested paths and array indexes', () => {
    expect(evaluate('{{$json.customer.city}}', json)).toBe('Hue');
    expect(evaluate('{{$json.tags[1]}}', json)).toBe('b');
  });

  it('does not reach prototype members', () => {
    expect(evaluate('{{$json.constructor}}', json)).toBeNull();
    expect(evaluate('{{$json.__proto__}}', json)).toBeNull();
  });

  it('keeps text without a complete expression as is', () => {
    expect(evaluate('plain', json)).toBe('plain');
    expect(evaluate('open {{ only', json)).toBe('open {{ only');
  });

  it('throws on invalid syntax', () => {
    expect(() => parseTemplate('{{$json.}}')).toThrow(ExpressionSyntaxError);
  });
});

describe('readField', () => {
  const json = { status: 'new', 'Full Name': 'An', data: { label: 'urgent' } };

  it('reads simple, dotted and verbatim keys', () => {
    expect(readField(json, 'status')).toBe('new');
    expect(readField(json, 'data.label')).toBe('urgent');
    expect(readField(json, 'Full Name')).toBe('An');
  });

  it('returns undefined for missing or malformed paths', () => {
    expect(readField(json, 'missing')).toBeUndefined();
    expect(readField(json, 'data..label')).toBeUndefined();
    expect(readField(json, '')).toBeUndefined();
  });
});

describe('resolveConfig / applySchemaDefaults', () => {
  const schema = {
    type: 'object',
    properties: {
      subject: { type: 'string', 'x-allowExpression': true },
      to: {
        type: 'string',
        'x-allowExpression': true,
        default: '{{$json.email}}',
      },
      field: { type: 'string' },
      count: { type: 'integer' },
    },
  };

  it('resolves only fields marked x-allowExpression', () => {
    const config = resolveConfig(
      { subject: 'Hi {{name}}', field: '{{name}}', count: 3 },
      schema,
      ctx({ name: 'An' }),
    );
    expect(config).toEqual({ subject: 'Hi An', field: '{{name}}', count: 3 });
  });

  it('leaves non-string values and unknown schemas untouched', () => {
    expect(resolveConfig({ subject: 5 }, schema, ctx({}))).toEqual({
      subject: 5,
    });
    expect(
      resolveConfig({ subject: '{{name}}' }, undefined, ctx({ name: 'x' })),
    ).toEqual({
      subject: '{{name}}',
    });
  });

  it('names the config field when an expression is invalid', () => {
    expect(() =>
      resolveConfig({ subject: '{{$json.}}' }, schema, ctx({})),
    ).toThrow(/Config "subject"/);
  });

  it('fills missing keys with schema defaults only', () => {
    expect(applySchemaDefaults({}, schema)).toEqual({ to: '{{$json.email}}' });
    expect(applySchemaDefaults({ to: 'a@b.c' }, schema)).toEqual({
      to: 'a@b.c',
    });
    expect(applySchemaDefaults({ to: null }, schema)).toEqual({
      to: '{{$json.email}}',
    });
  });
});
