import { placeholderFor, propertyTitle } from '../../utils/node-config';
import type { PropertySchema } from '../../utils/node-config';
import { CredentialPicker, OAuthField } from './CredentialField';
import { EnumField } from './EnumField';
import { NumberField } from './NumberField';
import { TextField } from './TextField';

interface ConfigFieldProps {
  fieldKey: string;
  schema: PropertySchema;
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  onConnectOAuth: () => void;
}

// Picks the control for one config field from its JSON Schema and x-* hints.
export function ConfigField({
  fieldKey,
  schema,
  config,
  onChange,
  onConnectOAuth,
}: ConfigFieldProps) {
  const id = `field-${fieldKey}`;
  const label = propertyTitle(fieldKey, schema);
  const value = config[fieldKey];
  const change = (next: unknown) => onChange(fieldKey, next);

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
  // Typed into a form (e.g. a Facebook Page's ID and token), not an OAuth pop-up.
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
  if (Array.isArray(schema.enum)) {
    return (
      <EnumField
        id={id}
        label={label}
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
