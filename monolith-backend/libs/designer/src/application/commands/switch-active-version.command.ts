// Sent after a new version became current (publish, restore); handled by the
// triggers module. An active workflow then listens with the new version.
// Result: null when the workflow is not active, otherwise the version that
// listens now. With `error` the new version could not listen: the previous
// version keeps listening (active true) or, when none did, the workflow was
// turned off (active false).
export class SwitchActiveVersionCommand {
  constructor(readonly workflowId: string) {}
}

export type SwitchActiveVersionResult = {
  active: boolean;
  versionId: string | null;
  error?: string;
} | null;
