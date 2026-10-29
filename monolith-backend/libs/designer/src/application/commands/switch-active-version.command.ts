// Sent after a new version became current (publish, restore); handled by the
// triggers module. An active workflow then listens with the new version.
// Result: null when the workflow is not active, otherwise
// { active, error? } — active false means switching failed and the workflow
// was turned off.
export class SwitchActiveVersionCommand {
  constructor(readonly workflowId: string) {}
}

export type SwitchActiveVersionResult = {
  active: boolean;
  error?: string;
} | null;
