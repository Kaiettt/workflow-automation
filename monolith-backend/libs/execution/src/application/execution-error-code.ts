// Only these system-owned codes may cross the Admin projection boundary.
const safeCodes = new Set([
  'NODE_EXECUTION_FAILED',
  'WORKFLOW_EXECUTION_FAILED',
  'EXECUTION_QUEUE_FAILED',
  'EXECUTION_WORKER_INTERRUPTED',
  'UNCLASSIFIED_ERROR',
]);

export function safeExecutionErrorCode(
  code: string | null | undefined,
): string {
  return code && safeCodes.has(code) ? code : 'UNCLASSIFIED_ERROR';
}
