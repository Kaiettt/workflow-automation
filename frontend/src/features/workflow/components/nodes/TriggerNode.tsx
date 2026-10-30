import { BaseNode } from './BaseNode';
import type { WorkflowNodeProps } from './BaseNode';

export function TriggerNode(props: WorkflowNodeProps) {
  return <BaseNode {...props} trigger />;
}
