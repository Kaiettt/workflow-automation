// A saved credential as the API shows it: never the secret itself.
export interface CredentialSummary {
  id: string;
  connectorKey: string;
  name: string;
  createdAt: string;
}

// `secret` holds the fields of the connector's configSchema
// (e.g. { api_key } or { client_id, client_secret }).
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
  // OAuth2 credential types of integration packages: the redirect URL to
  // register in the provider app; the form is followed by a sign-in pop-up.
  oauth2?: { redirectUrl: string } | null;
}

// One input of the "add credential" form, read from the connector's configSchema.
export interface CredentialFormField {
  key: string;
  title: string;
  secret: boolean;
  description?: string;
}
