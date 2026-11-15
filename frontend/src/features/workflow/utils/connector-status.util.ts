import type { ConnectorSummary } from '../types/credential.types';

export function isNodeConnectorDisabled(
  node: {
    connectorId?: string | null;
    configSchema?: { properties?: Record<string, unknown> } | null;
  } | null | undefined,
  connectors: ConnectorSummary[] | undefined,
): boolean {
  if (!node || !connectors || connectors.length === 0) return false;

  const disabledConnectorIds = new Set(
    connectors.filter((c) => c.allowNewCredentials === false).map((c) => c.id),
  );
  const disabledConnectorKeys = new Set(
    connectors.filter((c) => c.allowNewCredentials === false).map((c) => c.key),
  );

  if (node.connectorId && disabledConnectorIds.has(node.connectorId)) {
    return true;
  }

  const properties = node.configSchema?.properties;
  if (properties && typeof properties === 'object') {
    for (const prop of Object.values(properties)) {
      if (prop && typeof prop === 'object' && 'x-connectorKey' in prop) {
        const key = String((prop as { 'x-connectorKey'?: unknown })['x-connectorKey']);
        if (disabledConnectorKeys.has(key)) {
          return true;
        }
      }
    }
  }

  return false;
}

