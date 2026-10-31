// Address outside callers (webhooks, OAuth redirects) use; falls back to the
// local server.
export function publicBaseUrl(): string {
  const configured = process.env['PUBLIC_BASE_URL']?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return `http://localhost:${process.env['PORT'] ?? 8080}`;
}

export function webhookUrl(endpointId: string): string {
  return `${publicBaseUrl()}/api/webhooks/${endpointId}`;
}

export function oauth2RedirectUrl(): string {
  return `${publicBaseUrl()}/api/oauth2/callback`;
}

// Origin of the designer (the window that opens the OAuth2 pop-up): the only
// window the callback page hands the authorization code to.
export function frontendOrigin(): string {
  const configured = process.env['FRONTEND_URL']?.trim();
  return configured ? new URL(configured).origin : 'http://localhost:5173';
}
