import {
  Condition,
  evaluateCondition,
  evaluateConditions,
} from '@app/execution/domain/conditions';

const both = { ignoreCase: true, ignoreAccents: true };
const exact = { ignoreCase: false, ignoreAccents: false };
const cond = (
  operator: Condition['operator'],
  value1: unknown,
  value2?: unknown,
): Condition => ({ operator, value1, value2 });

describe('evaluateCondition', () => {
  it('ignores case and Vietnamese accents by default', () => {
    expect(
      evaluateCondition(cond('contains', 'Cho xin BẢNG GIÁ', 'bang gia'), both),
    ).toBe(true);
    expect(
      evaluateCondition(cond('equals', 'Đặt hàng', 'dat hang'), both),
    ).toBe(true);
  });

  it('is exact when both options are off', () => {
    expect(
      evaluateCondition(cond('contains', 'Bảng giá', 'bang gia'), exact),
    ).toBe(false);
    expect(evaluateCondition(cond('equals', 'Hi', 'hi'), exact)).toBe(false);
    expect(evaluateCondition(cond('equals', 'Hi', 'Hi'), exact)).toBe(true);
  });

  it.each([
    ['equals', 'abc', 'abc', true],
    ['equals', 'abc', 'abd', false],
    ['not_equals', 'abc', 'abd', true],
    ['contains', 'hello world', 'lo wo', true],
    ['not_contains', 'hello', 'xyz', true],
    ['not_contains', 'hello', 'ell', false],
    ['starts_with', 'hello', 'he', true],
    ['starts_with', 'hello', 'lo', false],
    ['ends_with', 'hello', 'lo', true],
    ['ends_with', 'hello', 'he', false],
  ] as const)('%s(%j, %j) is %s', (operator, a, b, expected) => {
    expect(evaluateCondition(cond(operator, a, b), both)).toBe(expected);
  });

  it('turns numbers, booleans and objects into text before comparing text', () => {
    expect(evaluateCondition(cond('equals', 42, '42'), both)).toBe(true);
    expect(evaluateCondition(cond('equals', true, 'true'), both)).toBe(true);
    expect(evaluateCondition(cond('contains', { a: 1 }, '"a":1'), both)).toBe(
      true,
    );
    expect(evaluateCondition(cond('equals', null, ''), both)).toBe(true);
  });

  it('compares numbers with gt and lt, and is false when a side is not a number', () => {
    expect(evaluateCondition(cond('gt', 10, '5'), both)).toBe(true);
    expect(evaluateCondition(cond('gt', '5', 10), both)).toBe(false);
    expect(evaluateCondition(cond('lt', '5', '10'), both)).toBe(true);
    expect(evaluateCondition(cond('gt', 'abc', 1), both)).toBe(false);
    expect(evaluateCondition(cond('lt', '', 1), both)).toBe(false);
    expect(evaluateCondition(cond('gt', 5, 5), both)).toBe(false);
  });

  it('checks for empty values', () => {
    for (const empty of [null, undefined, '', '   ', []]) {
      expect(evaluateCondition(cond('is_empty', empty), both)).toBe(true);
      expect(evaluateCondition(cond('is_not_empty', empty), both)).toBe(false);
    }
    expect(evaluateCondition(cond('is_not_empty', 'x'), both)).toBe(true);
    expect(evaluateCondition(cond('is_empty', 0), both)).toBe(false);
  });

  it('matches a regular expression, case-insensitively when asked', () => {
    expect(evaluateCondition(cond('regex', 'Order #1234', '#\\d+'), both)).toBe(
      true,
    );
    expect(evaluateCondition(cond('regex', 'HELLO', '^hello$'), both)).toBe(
      true,
    );
    expect(evaluateCondition(cond('regex', 'HELLO', '^hello$'), exact)).toBe(
      false,
    );
  });

  it('rejects an invalid or oversized regular expression', () => {
    expect(() => evaluateCondition(cond('regex', 'x', '('), both)).toThrow(
      /not a valid regular expression/,
    );
    expect(() =>
      evaluateCondition(cond('regex', 'x', 'a'.repeat(501)), both),
    ).toThrow(/limited to 500/);
  });
});

describe('evaluateConditions', () => {
  const yes = cond('equals', 'a', 'a');
  const no = cond('equals', 'a', 'b');

  it('needs every condition for "and"', () => {
    expect(evaluateConditions([yes, yes], 'and', both)).toBe(true);
    expect(evaluateConditions([yes, no], 'and', both)).toBe(false);
  });

  it('needs one condition for "or"', () => {
    expect(evaluateConditions([no, yes], 'or', both)).toBe(true);
    expect(evaluateConditions([no, no], 'or', both)).toBe(false);
  });
});
