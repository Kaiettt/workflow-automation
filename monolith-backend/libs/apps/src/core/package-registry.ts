import {
  ActionNode,
  CredentialType,
  IntegrationPackage,
  PackageNode,
  TriggerNode,
} from './package';

// Every installed package, looked up by node or credential type key.
export class PackageRegistry {
  private readonly nodes = new Map<string, PackageNode>();
  private readonly credentials = new Map<string, CredentialType>();

  constructor(readonly packages: readonly IntegrationPackage[]) {
    for (const pkg of packages) {
      for (const node of pkg.nodes) {
        if (this.nodes.has(node.key)) {
          throw new Error(`Node type "${node.key}" is declared twice`);
        }
        this.nodes.set(node.key, node);
      }
      for (const credential of pkg.credentials) {
        if (this.credentials.has(credential.key)) {
          throw new Error(
            `Credential type "${credential.key}" is declared twice`,
          );
        }
        this.credentials.set(credential.key, credential);
      }
    }
  }

  allNodes(): PackageNode[] {
    return [...this.nodes.values()];
  }

  allCredentialTypes(): CredentialType[] {
    return [...this.credentials.values()];
  }

  node(key: unknown): PackageNode | undefined {
    return typeof key === 'string' ? this.nodes.get(key) : undefined;
  }

  trigger(key: unknown): TriggerNode | undefined {
    const node = this.node(key);
    return node?.kind === 'trigger' ? node : undefined;
  }

  action(key: unknown): ActionNode | undefined {
    const node = this.node(key);
    return node?.kind === 'action' ? node : undefined;
  }

  credentialType(key: unknown): CredentialType | undefined {
    return typeof key === 'string' ? this.credentials.get(key) : undefined;
  }
}
