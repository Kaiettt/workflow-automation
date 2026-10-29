import { placeholderFor, propertyTitle } from '../../utils/node-config';
import type { PropertySchema } from '../../utils/node-config';
import { CredentialPicker, OAuthField } from './CredentialField';
import { LoadOptionsField } from './LoadOptionsField';
import { EnumField } from './EnumField';
import { NumberField } from './NumberField';
import { TextField } from './TextField';

interface ConfigFieldProps {
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
  nodeKey,
  fieldKey,
  schema,
  config,
  needsCredential = false,
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
