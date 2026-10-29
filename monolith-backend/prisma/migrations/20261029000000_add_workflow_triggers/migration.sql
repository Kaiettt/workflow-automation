-- AlterTable: Active switch (only active workflows receive events)
ALTER TABLE "workflows" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "webhook_endpoints" (
    "id" UUID NOT NULL,
    "scope_key" VARCHAR(255) NOT NULL,
    "node_key" VARCHAR(150) NOT NULL,
    "workflow_id" UUID,
    "credential_id" UUID,
    "owner_id" UUID NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "registered" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_triggers" (
    "id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "workflow_version_id" UUID NOT NULL,
    "node_id" VARCHAR(100) NOT NULL,
    "node_key" VARCHAR(150) NOT NULL,
    "endpoint_id" UUID NOT NULL,
    "credential_id" UUID,
    "parameters" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "webhook_endpoints_scope_key_key" ON "webhook_endpoints"("scope_key");

-- CreateIndex
CREATE INDEX "workflow_triggers_endpoint_id_idx" ON "workflow_triggers"("endpoint_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_triggers_workflow_id_node_id_key" ON "workflow_triggers"("workflow_id", "node_id");

-- AddForeignKey
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "connector_credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_triggers" ADD CONSTRAINT "workflow_triggers_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_triggers" ADD CONSTRAINT "workflow_triggers_workflow_version_id_fkey" FOREIGN KEY ("workflow_version_id") REFERENCES "workflow_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_triggers" ADD CONSTRAINT "workflow_triggers_endpoint_id_fkey" FOREIGN KEY ("endpoint_id") REFERENCES "webhook_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
