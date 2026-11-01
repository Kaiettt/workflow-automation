import { placeholderFor, propertyTitle } from '../../utils/node-config';
import type { PropertySchema } from '../../utils/node-config';
import { CredentialPicker, OAuthField } from './CredentialField';
import { LoadOptionsField } from './LoadOptionsField';
import { BooleanField } from './BooleanField';
import { EnumField } from './EnumField';
import { ListField } from './ListField';
import { NumberField } from './NumberField';
import { TextField } from './TextField';

interface ConfigFieldProps {
  // Keeps element ids apart when the same field appears in several list rows.
  idPrefix?: string;
  nodeKey: string;
  fieldKey: string;
  schema: PropertySchema;
  config: Record<string, unknown>;
  // The node requires a credential: dynamic options need it first.
  needsCredential?: boolean;
  onChange: (key: string, value: unknown) => void;
  onConnectOAuth: () => void;
}

// Picks the control for one config field from its JSON Schema and x-* hints.
export function ConfigField({
  idPrefix = '',
  nodeKey,
  fieldKey,
  schema,
  config,
  needsCredential = false,
  onChange,
  onConnectOAuth,
}: ConfigFieldProps) {
  const id = `${idPrefix}field-${fieldKey}`;
  const label = propertyTitle(fieldKey, schema);
  const value = config[fieldKey];
  const change = (next: unknown) => onChange(fieldKey, next);

  // Hidden while a sibling field has one of the listed values (an "is empty"
  // condition has nothing to compare to).
  const hideWhen = schema['x-hideWhen'] as { field?: string; in?: unknown[] } | undefined;
  if (hideWhen?.field && Array.isArray(hideWhen.in) && hideWhen.in.includes(config[hideWhen.field])) {
    return null;
  }

  if (typeof schema['x-connectorKeyFrom'] === 'string') {
    const provider = config[schema['x-connectorKeyFrom']];
    return (
      <CredentialPicker
        id={id}
        label={label}
        connectorKey={typeof provider === 'string' && provider ? provider : undefined}
        value={typeof value === 'string' ? value : ''}
        onChange={change}
      />
    );
  }
  // Created from a form (API key, or an OAuth2 app's ID / secret followed by
  // a sign-in pop-up) and picked from the saved ones.
  if (typeof schema['x-connectorKey'] === 'string' && schema['x-credentialInput'] === 'form') {
    return (
      <CredentialPicker
        id={id}
        label={label}
        connectorKey={schema['x-connectorKey']}
        value={typeof value === 'string' ? value : ''}
        onChange={change}
      />
    );
  }
  if (schema['x-connectorKey']) {
    return (
      <OAuthField
        id={id}
        label={label}
        connectorName={String(schema['x-connectorKey'])}
        connected={!!value}
        onConnect={onConnectOAuth}
      />
    );
  }
  // Choices read from the server with the node's credential (e.g. its Pages).
  if (schema['x-loadOptions'] === true) {
    const credentialId = config.credential_id;
    return (
      <LoadOptionsField
        id={id}
        label={label}
        nodeKey={nodeKey}
        property={fieldKey}
        credentialId={typeof credentialId === 'string' && credentialId ? credentialId : undefined}
        needsCredential={needsCredential}
        value={typeof value === 'string' ? value : ''}
        hint={typeof schema.description === 'string' ? schema.description : undefined}
        onChange={change}
      />
    );
  }
  if (schema.type === 'array' && typeof schema.items === 'object' && schema.items !== null) {
    return (
      <ListField
        id={id}
        label={label}
        nodeKey={nodeKey}
        itemSchema={schema.items as PropertySchema}
        rows={Array.isArray(value) ? (value as Record<string, unknown>[]) : []}
        onChange={change}
      />
    );
  }
  if (schema.type === 'boolean') {
    return (
      <BooleanField
        id={id}
        label={label}
        value={value === true}
        hint={typeof schema.description === 'string' ? schema.description : undefined}
        onChange={change}
      />
    );
  }
  if (Array.isArray(schema.enum)) {
    const labels = schema['x-enumLabels'];
    return (
      <EnumField
        id={id}
        label={label}
        labels={typeof labels === 'object' && labels !== null ? (labels as Record<string, string>) : undefined}
        options={schema.enum.map(String)}
        value={typeof value === 'string' ? value : ''}
        onChange={change}
      />
    );
  }
  if (schema.type === 'integer' || schema.type === 'number') {
    return (
      <NumberField
        id={id}
        label={label}
        integer={schema.type === 'integer'}
        min={typeof schema.minimum === 'number' ? schema.minimum : undefined}
        value={typeof value === 'number' ? value : undefined}
        onChange={change}
      />
    );
  }
  return (
    <TextField
      id={id}
      label={label}
      multiline={schema['x-multiline'] === true}
      expression={schema['x-allowExpression'] === true}
      placeholder={placeholderFor(schema, config)}
      hint={typeof schema.description === 'string' ? schema.description : undefined}
      value={typeof value === 'string' ? value : ''}
      onChange={change}
    />
  );
}
