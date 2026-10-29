import { Module } from '@nestjs/common';
import { PackageRegistry } from './core/package-registry';
import { createPackages } from './packages';
import { HttpMetaGraphApi, MetaGraphApi } from './messenger/meta-graph.api';

// Replaceable in tests so nothing is sent to Facebook.
export const META_GRAPH_API = 'META_GRAPH_API';

@Module({
  providers: [
    { provide: META_GRAPH_API, useClass: HttpMetaGraphApi },
    {
      provide: PackageRegistry,
      useFactory: (metaGraph: MetaGraphApi) =>
        new PackageRegistry(createPackages({ metaGraph })),
      inject: [META_GRAPH_API],
    },
  ],
  exports: [PackageRegistry, META_GRAPH_API],
})
export class AppsModule {}
