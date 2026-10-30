import { CredentialType, NodeProperty, PackageNode } from './package';

// Node and credential declarations → the JSON Schemas the catalog stores and
// the designer draws forms from (x-* hints: docs/schema/rule-for-config-schema.md).

export const CREDENTIAL_FIELD = 'credential_id';

export function nodeConfigSchema(node: PackageNode): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  const order: string[] = [];

  if (node.credentialType) {
    properties[CREDENTIAL_FIELD] = {
      type: 'string',
      title: 'Credential',
      'x-refType': 'credential',
      'x-connectorKey': node.credentialType,
      'x-credentialInput': 'form',
    };
    required.push(CREDENTIAL_FIELD);
    order.push(CREDENTIAL_FIELD);
  }
  for (const property of node.properties) {
    properties[property.name] = propertySchema(property);
    if (property.required) required.push(property.name);
    order.push(property.name);
    // Right after the field that decides its type, hidden while that is "none".
    if (node.credentialTypeFrom?.field === property.name) {
      properties[CREDENTIAL_FIELD] = {
        type: 'string',
        title: 'Credential',
        'x-refType': 'credential',
        'x-connectorKeyFrom': property.name,
        'x-hideWhen': { field: property.name, in: ['none', ''] },
      };
      order.push(CREDENTIAL_FIELD);
    }
  }

  return {
    type: 'object',
    ...(required.length > 0 ? { required } : {}),
    'x-propertyOrder': order,
    ...(node.kind === 'trigger'
      ? { 'x-webhook': { scope: node.webhook.scope } }
      : {}),
    properties,
  };
}

function propertySchema(property: NodeProperty): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    type:
      property.type === 'options'
        ? 'string'
        : property.type === 'number'
          ? 'number'
          : property.type === 'collection'
            ? 'array'
            : property.type,
    title: property.displayName,
  };
  if (property.type === 'collection') {
    const fields = property.fields ?? [];
    schema.items = {
      type: 'object',
      'x-propertyOrder': fields.map((field) => field.name),
      properties: Object.fromEntries(
        fields.map((field) => [field.name, propertySchema(field)]),
      ),
    };
  }
  if (property.hideWhen) schema['x-hideWhen'] = property.hideWhen;
  if (property.description) schema.description = property.description;
  if (property.default !== undefined) schema.default = property.default;
  if (property.placeholder) schema['x-placeholder'] = property.placeholder;
  if (property.expression) schema['x-allowExpression'] = true;
  if (property.multiline) schema['x-multiline'] = true;
  if (property.options) {
    schema.enum = property.options.map((option) => option.value);
    schema['x-enumLabels'] = Object.fromEntries(
      property.options.map((option) => [option.value, option.label]),
    );
  }
  if (property.loadOptions) schema['x-loadOptions'] = true;
  return schema;
}

export function credentialConfigSchema(
  credential: CredentialType,
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const field of credential.fields) {
    properties[field.name] = {
      type: 'string',
      title: field.displayName,
      ...(field.description ? { description: field.description } : {}),
      ...(field.secret ? { 'x-secret': true } : {}),
    };
  }
  return {
    type: 'object',
    required: credential.fields
      .filter((field) => field.required !== false)
      .map((field) => field.name),
    'x-propertyOrder': credential.fields.map((field) => field.name),
    ...(credential.oauth2 ? { 'x-oauth2': true } : {}),
    properties,
  };
}

// The node's parameters as stored in a definition, without the credential.
export function nodeParameters(config: unknown): Record<string, unknown> {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    return {};
  }
  const { [CREDENTIAL_FIELD]: _credential, ...rest } = config as Record<
    string,
    unknown
  >;
  void _credential;
  return rest;
}
