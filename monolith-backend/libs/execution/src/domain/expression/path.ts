import { ExpressionSyntaxError } from './errors';

export type PathSegment =
  { kind: 'key'; name: string } | { kind: 'index'; index: number };

const IDENT_START = /[A-Za-z_]/;
const IDENT_PART = /[A-Za-z0-9_]/;

export class Cursor {
  pos = 0;

  constructor(readonly source: string) {}

  get done(): boolean {
    return this.pos >= this.source.length;
  }

  peek(): string {
    return this.source[this.pos] ?? '';
  }

  skipWhitespace(): void {
    while (!this.done && /\s/.test(this.peek())) this.pos += 1;
  }

  startsWith(text: string): boolean {
    return this.source.startsWith(text, this.pos);
  }

  fail(message: string): never {
    throw new ExpressionSyntaxError(
      `${message} at position ${this.pos} in "${this.source}"`,
    );
  }

  expect(char: string): void {
    if (this.peek() !== char) this.fail(`Expected "${char}"`);
    this.pos += 1;
  }

  readIdentifier(): string {
    if (!IDENT_START.test(this.peek())) this.fail('Expected a field name');
    const start = this.pos;
    this.pos += 1;
    while (!this.done && IDENT_PART.test(this.peek())) this.pos += 1;
    return this.source.slice(start, this.pos);
  }

  readQuoted(): string {
    const quote = this.peek();
    if (quote !== '"' && quote !== "'") this.fail('Expected a quoted string');
    this.pos += 1;
    let value = '';
    while (!this.done && this.peek() !== quote) {
      if (this.peek() === '\\' && this.pos + 1 < this.source.length) {
        this.pos += 1;
      }
      value += this.peek();
      this.pos += 1;
    }
    if (this.done) this.fail('Unterminated string');
    this.pos += 1;
    return value;
  }
}

export function parsePathSegments(cursor: Cursor): PathSegment[] {
  const path: PathSegment[] = [];
  for (;;) {
    if (cursor.peek() === '.') {
      cursor.pos += 1;
      path.push({ kind: 'key', name: cursor.readIdentifier() });
    } else if (cursor.peek() === '[') {
      cursor.pos += 1;
      const next = cursor.peek();
      if (next === '"' || next === "'") {
        path.push({ kind: 'key', name: cursor.readQuoted() });
      } else {
        const start = cursor.pos;
        while (/[0-9]/.test(cursor.peek())) cursor.pos += 1;
        if (start === cursor.pos) {
          cursor.fail('Expected an index or a quoted key');
        }
        path.push({
          kind: 'index',
          index: Number(cursor.source.slice(start, cursor.pos)),
        });
      }
      cursor.expect(']');
    } else {
      return path;
    }
  }
}

export function readPath(base: unknown, path: PathSegment[]): unknown {
  let current: unknown = base;
  for (const segment of path) {
    if (current === null || current === undefined) return undefined;
    if (segment.kind === 'index') {
      if (!Array.isArray(current)) return undefined;
      current = current[segment.index];
    } else {
      if (typeof current !== 'object' || Array.isArray(current)) {
        return undefined;
      }
      // Own properties only: never reach prototype members such as "constructor".
      if (!Object.prototype.hasOwnProperty.call(current, segment.name)) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[segment.name];
    }
  }
  return current;
}

// Reads a field from an item, e.g. "status", "data.label", "items[0].name".
// A key that exists verbatim (such as a sheet header "Full Name") wins over path parsing.
export function readField(
  json: Record<string, unknown>,
  field: string,
): unknown {
  if (Object.prototype.hasOwnProperty.call(json, field)) return json[field];
  try {
    const cursor = new Cursor(field);
    const path: PathSegment[] = [
      { kind: 'key', name: cursor.readIdentifier() },
    ];
    path.push(...parsePathSegments(cursor));
    if (!cursor.done) return undefined;
    return readPath(json, path);
  } catch {
    return undefined;
  }
}
