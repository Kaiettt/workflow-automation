// A saved credential as the API shows it: never the secret itself.
export interface CredentialSummary {
  id: string;
  connectorKey: string;
  name: string;
  createdAt: string;
}

export interface CreateApiKeyCredentialRequest {
  name: string;
  api_key: string;
}
