import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CheckPublishTriggersQuery } from '@app/designer/application/queries/check-publish-triggers.query';
import type { PublishValidationIssue } from '@app/designer/application/utils';
import { CREDENTIAL_FIELD, PackageRegistry } from '@app/apps';
import { CredentialVault } from '@app/connector/application/credential-vault';
import { definitionNodes } from '../../domain/definition-nodes';

// Stops a version whose package nodes point at a credential the owner does
// not have, or of the wrong type (a missing one is a required-field issue).
@QueryHandler(CheckPublishTriggersQuery)
export class CheckPublishTriggersHandler implements IQueryHandler<CheckPublishTriggersQuery> {
  constructor(
    private readonly registry: PackageRegistry,
    private readonly vault: CredentialVault,
  ) {}

  async execute(
    query: CheckPublishTriggersQuery,
  ): Promise<PublishValidationIssue[]> {
    const issues: PublishValidationIssue[] = [];
    for (const node of definitionNodes(query.definition)) {
      const credentialType = this.registry.node(node.key)?.credentialType;
      const chosen = node.config[CREDENTIAL_FIELD];
      if (!credentialType || typeof chosen !== 'string' || chosen === '') {
        continue;
      }
      const stored = await this.vault.findOwned(chosen, query.ownerId);
      if (!stored || stored.connectorKey !== credentialType) {
        issues.push({
          severity: 'error',
          code: 'INVALID_CREDENTIAL',
          nodeId: node.id,
          field: CREDENTIAL_FIELD,
          message: stored
            ? 'The selected credential belongs to another app.'
            : 'The selected credential no longer exists. Pick another one.',
        });
      }
    }
    return issues;
  }
}
