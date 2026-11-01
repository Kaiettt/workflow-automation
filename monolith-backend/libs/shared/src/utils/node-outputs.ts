export const MAIN_OUTPUT = 'main';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface OutputDef {
  key: string;
  label: string;
}

export const FALLBACK_OUTPUT = 'fallback';

// A rule with an id keeps its output when rules are reordered or deleted;
// without one the output is named by its position.
export function ruleOutputKey(entry: unknown, index: number): string {
  const id = isPlainObject(entry) ? entry.id : undefined;
  return typeof id === 'string' && id ? `rule_${id}` : `rule_${index}`;
}

// The outputs a node has, from the `x-outputs` of its config schema:
//   { static: [{ key, label }] }                          fixed outputs (IF)
//   { fromConfig: 'rules', labelField, fallback: true }   one per entry of a config list (Switch)
// A node without `x-outputs` has the single main output.
export function resolveOutputs(
  schema: unknown,
  config: Record<string, unknown>,
): OutputDef[] {
  const spec = isPlainObject(schema) ? schema['x-outputs'] : undefined;
  if (!isPlainObject(spec)) return [{ key: MAIN_OUTPUT, label: 'Output' }];

  if (Array.isArray(spec.static)) {
    return spec.static.filter(isOutputDef);
  }
  if (typeof spec.fromConfig === 'string') {
    const list = config[spec.fromConfig];
    const entries: unknown[] = Array.isArray(list) ? list : [];
    const labelField =
      typeof spec.labelField === 'string' ? spec.labelField : 'label';
    const outputs = entries.map((entry, index): OutputDef => {
      const label = isPlainObject(entry) ? entry[labelField] : undefined;
      return {
        key: ruleOutputKey(entry, index),
        label:
          typeof label === 'string' && label.trim()
            ? label
            : `Rule ${index + 1}`,
      };
    });
    if (spec.fallback === true) {
      outputs.push({ key: FALLBACK_OUTPUT, label: 'Fallback' });
    }
    return outputs;
  }
  return [{ key: MAIN_OUTPUT, label: 'Output' }];
}

function isOutputDef(value: unknown): value is OutputDef {
  return (
    isPlainObject(value) &&
    typeof value.key === 'string' &&
    typeof value.label === 'string'
  );
}
