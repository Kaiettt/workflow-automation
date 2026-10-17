export abstract class NodeCatalogPort {
  // config_schema of the given node type keys; unknown keys are absent from the map.
  abstract getConfigSchemas(keys: string[]): Promise<Map<string, unknown>>;
}
