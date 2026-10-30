import { BaseNode } from './BaseNode';
import type { WorkflowNodeProps } from './BaseNode';

export function ActionNode(props: WorkflowNodeProps) {
  return <BaseNode {...props} />;
}
