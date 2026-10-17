// What the API may reveal about a stored credential: never the secret itself.
export interface CredentialSummary {
  id: string;
  connectorKey: string;
  name: string;
  createdAt: Date;
}
