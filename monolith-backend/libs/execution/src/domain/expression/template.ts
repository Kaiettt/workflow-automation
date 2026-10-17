import { Item, ItemJson } from '../models/item';
import { ExpressionAst, parseExpression } from './parser';
import { readPath } from './path';

export interface ExpressionContext {
  currentItem: Item;
  // $node["name"].all
  getNodeAll(nodeName: string): ItemJson[];
  // $node["name"].json - the item of that node paired with the current item
  getPairedJson(nodeName: string): ItemJson;
}

export type TemplatePart =
  | { kind: 'text'; text: string }
  | { kind: 'expr'; source: string; ast: ExpressionAst };

export function parseTemplate(value: string): TemplatePart[] {
  const parts: TemplatePart[] = [];
  let index = 0;
  while (index < value.length) {
    const open = value.indexOf('{{', index);
    const close = open === -1 ? -1 : value.indexOf('}}', open + 2);
    if (open === -1 || close === -1) {
      // No (complete) expression left: the rest is literal text.
      parts.push({ kind: 'text', text: value.slice(index) });
      break;
    }
    if (open > index) {
      parts.push({ kind: 'text', text: value.slice(index, open) });
    }
    const source = value.slice(open + 2, close);
    parts.push({
      kind: 'expr',
      source: source.trim(),
      ast: parseExpression(source),
    });
    index = close + 2;
  }
  return parts;
}

function evaluateAst(ast: ExpressionAst, ctx: ExpressionContext): unknown {
  if (ast.root === 'json') {
    return readPath(ctx.currentItem.json, ast.path);
  }
  if (ast.access === 'all') {
    return readPath(ctx.getNodeAll(ast.nodeName), ast.path);
  }
  return readPath(ctx.getPairedJson(ast.nodeName), ast.path);
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value) ?? '';
}

// A field that is exactly one expression keeps the value's type;
// anything else is concatenated into a string.
export function evaluateTemplate(
  parts: TemplatePart[],
  ctx: ExpressionContext,
): unknown {
  if (parts.length === 1 && parts[0].kind === 'expr') {
    return evaluateAst(parts[0].ast, ctx) ?? null;
  }
  return parts
    .map((part) =>
      part.kind === 'text' ? part.text : toText(evaluateAst(part.ast, ctx)),
    )
    .join('');
}
