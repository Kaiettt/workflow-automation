// Outputs of a node, read from the `x-outputs` of its config schema (same
// rules as the backend, libs/shared/src/utils/node-outputs.ts):
//   { static: [{ key, label }] }                          fixed outputs (IF)
//   { fromConfig: 'rules', labelField, fallback: true }   one per entry of a config list (Switch)
// A node without `x-outputs` has the single main output.
export interface OutputDef {
  key: string;
  label: string;
}

export const MAIN_OUTPUT = 'main';
const OUTPUT_HANDLE_PREFIX = 'out:';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function resolveOutputs(schema: unknown, config: unknown): OutputDef[] {
  const spec = isRecord(schema) ? schema['x-outputs'] : undefined;
  const main = [{ key: MAIN_OUTPUT, label: 'Output' }];
  if (!isRecord(spec)) return main;

  if (Array.isArray(spec.static)) {
    return spec.static.filter(
      (entry): entry is OutputDef =>
        isRecord(entry) && typeof entry.key === 'string' && typeof entry.label === 'string',
    );
  }
  if (typeof spec.fromConfig === 'string') {
    const list = isRecord(config) ? config[spec.fromConfig] : undefined;
    const entries: unknown[] = Array.isArray(list) ? list : [];
    const labelField = typeof spec.labelField === 'string' ? spec.labelField : 'label';
    const outputs = entries.map((entry, index): OutputDef => {
      const label = isRecord(entry) ? entry[labelField] : undefined;
      const id = isRecord(entry) ? entry.id : undefined;
      return {
        key: typeof id === 'string' && id ? `rule_${id}` : `rule_${index}`,
        label: typeof label === 'string' && label.trim() ? label : `Rule ${index + 1}`,
      };
    });
    if (spec.fallback === true) outputs.push({ key: 'fallback', label: 'Fallback' });
    return outputs;
  }
  return main;
}

// A node with named outputs draws one labelled handle per output; the others keep the four plain sides.
export function hasNamedOutputs(outputs: OutputDef[]): boolean {
  return outputs.length !== 1 || outputs[0].key !== MAIN_OUTPUT;
}

export function outputHandleId(key: string): string {
  return `${OUTPUT_HANDLE_PREFIX}${key}`;
}

export function outputOfHandle(handle: string | null | undefined): string | null {
  return typeof handle === 'string' && handle.startsWith(OUTPUT_HANDLE_PREFIX)
    ? handle.slice(OUTPUT_HANDLE_PREFIX.length)
    : null;
}
