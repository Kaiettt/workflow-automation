// A saved credential as the API shows it: never the secret itself.
export interface CredentialSummary {
  id: string;
  connectorKey: string;
  name: string;
  createdAt: string;
}

// `secret` holds the fields of the connector's configSchema
// (e.g. { api_key } or { page_id, page_access_token }).
export interface CreateCredentialRequest {
  name: string;
  secret: Record<string, string>;
}

export interface ConnectorSummary {
  id: string;
  key: string;
  name: string;
  authType: 'NONE' | 'API_KEY' | 'OAUTH2' | 'BASIC';
  configSchema: unknown;
}

// One input of the "add credential" form, read from the connector's configSchema.
export interface CredentialFormField {
  key: string;
  title: string;
  secret: boolean;
}
