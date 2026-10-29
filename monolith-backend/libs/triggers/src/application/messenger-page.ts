import { WorkflowTriggerRepository } from '../domain/workflow-trigger.repository';

const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export type MessengerPageLookup =
  | { pageId: string }
  | { error: 'NOT_FOUND' | 'WRONG_CONNECTOR' | 'NO_PAGE_ID' };

// The Page a Messenger trigger listens on: page_id of its credential, which
// must be a Messenger credential of the workflow owner.
export async function findMessengerPage(
  repository: WorkflowTriggerRepository,
  credentialId: string,
  ownerId: string,
): Promise<MessengerPageLookup> {
  // The column is a UUID: anything else would make the query itself fail.
  if (!UUID_PATTERN.test(credentialId)) return { error: 'NOT_FOUND' };
  const credential = await repository.findCredential(credentialId, ownerId);
  if (!credential) return { error: 'NOT_FOUND' };
  if (credential.connectorKey !== 'messenger') {
    return { error: 'WRONG_CONNECTOR' };
  }
  const pageId = credential.secret.page_id;
  return typeof pageId === 'string' && pageId.trim()
    ? { pageId: pageId.trim() }
    : { error: 'NO_PAGE_ID' };
}
