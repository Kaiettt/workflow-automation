const TERMINAL_STATUSES = new Set(['SUCCESS', 'FAILED', 'CANCELLED']);

export function isTerminalExecutionState(
  eventName: string,
  status: unknown,
): boolean {
  return (
    (typeof status === 'string' && TERMINAL_STATUSES.has(status)) ||
    eventName === 'execution.completed' ||
    eventName === 'execution.failed' ||
    eventName === 'execution.cancelled'
  );
}