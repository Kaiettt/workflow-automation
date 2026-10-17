import { Cursor, parsePathSegments, PathSegment } from './path';

export type ExpressionAst =
  | { root: 'json'; path: PathSegment[] }
  | {
      root: 'node';
      nodeName: string;
      access: 'json' | 'all';
      path: PathSegment[];
    };

// Grammar (not JavaScript - only data access):
//   expr := '$json' path
//         | '$node' '[' string ']' ('.json' | '.all') path
//         | ident path                      (legacy: {{name}} == {{$json.name}})
//   path := ( '.' ident | '[' (int | string) ']' )*
export function parseExpression(source: string): ExpressionAst {
  const cursor = new Cursor(source);
  cursor.skipWhitespace();

  let ast: ExpressionAst;
  if (cursor.startsWith('$json')) {
    cursor.pos += '$json'.length;
    ast = { root: 'json', path: parsePathSegments(cursor) };
  } else if (cursor.startsWith('$node')) {
    cursor.pos += '$node'.length;
    cursor.expect('[');
    const nodeName = cursor.readQuoted();
    cursor.expect(']');
    cursor.expect('.');
    const access = cursor.readIdentifier();
    if (access !== 'json' && access !== 'all') {
      cursor.fail('Expected ".json" or ".all" after $node["name"]');
    }
    ast = {
      root: 'node',
      nodeName,
      access: access as 'json' | 'all',
      path: parsePathSegments(cursor),
    };
  } else {
    const name = cursor.readIdentifier();
    ast = {
      root: 'json',
      path: [{ kind: 'key', name }, ...parsePathSegments(cursor)],
    };
  }

  cursor.skipWhitespace();
  if (!cursor.done) cursor.fail('Unexpected input');
  return ast;
}
