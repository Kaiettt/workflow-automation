import { credentialApi } from '../api/credential.api';
import { orderedProperties, propertyTitle } from '../utils/node-config';
import type {
  ConnectorSummary,
  CredentialFormField,
  CredentialSummary,
} from '../types/credential.types';

// Connectors whose schema declares no field take a single API key.
const API_KEY_FIELD: CredentialFormField = { key: 'api_key', title: 'API key', secret: true };

export const credentialService = {
  list: (connectorKey: string): Promise<CredentialSummary[]> =>
    credentialApi.list(connectorKey),

  listConnectors: (): Promise<ConnectorSummary[]> => credentialApi.listConnectors(),

  save: (
    connectorKey: string,
    name: string,
    values: Record<string, string>,
  ): Promise<CredentialSummary> =>
    credentialApi.create(connectorKey, {
      name: name.trim(),
      secret: Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, value.trim()]),
      ),
    }),

  // Inputs of the "add credential" form; x-secret fields are typed hidden.
  formFields: (connector: ConnectorSummary | undefined): CredentialFormField[] => {
    const fields = orderedProperties(connector?.configSchema).map(([key, property]) => ({
      key,
      title: propertyTitle(key, property),
      secret: property['x-secret'] === true,
      ...(typeof property.description === 'string' ? { description: property.description } : {}),
    }));
    return fields.length > 0 ? fields : [API_KEY_FIELD];
  },
};
