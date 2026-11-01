import { IntegrationPackage } from './core/package';
import { webhookPackage } from './webhook/webhook.package';
import { createMessengerPackage } from './messenger/messenger.package';
import { createHttpPackage } from './http/http.package';
import { MetaGraphApi } from './messenger/meta-graph.api';

export interface PackageDependencies {
  metaGraph: MetaGraphApi;
}

// The installed integration packages. Adding an app = one line here.
export function createPackages(
  deps: PackageDependencies,
): IntegrationPackage[] {
  return [
    webhookPackage,
    createMessengerPackage(deps.metaGraph),
    createHttpPackage(),
  ];
}
