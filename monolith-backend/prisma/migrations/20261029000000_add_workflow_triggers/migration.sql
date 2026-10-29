-- CreateEnum
CREATE TYPE "TriggerChannel" AS ENUM ('WEBHOOK', 'MESSENGER', 'ZALO_OA');

-- CreateTable
CREATE TABLE "workflow_triggers" (
    "id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "workflow_version_id" UUID NOT NULL,
    "node_id" VARCHAR(100) NOT NULL,
    "trigger_key" VARCHAR(150) NOT NULL,
    "channel" "TriggerChannel" NOT NULL,
    "routing_key" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workflow_triggers_channel_routing_key_is_active_idx" ON "workflow_triggers"("channel", "routing_key", "is_active");

-- CreateIndex
CREATE INDEX "workflow_triggers_workflow_id_idx" ON "workflow_triggers"("workflow_id");

-- One active listener per channel + routing key (Prisma cannot express a partial index).
CREATE UNIQUE INDEX "workflow_triggers_active_routing_key_key" ON "workflow_triggers"("channel", "routing_key") WHERE "is_active";

-- AddForeignKey
ALTER TABLE "workflow_triggers" ADD CONSTRAINT "workflow_triggers_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_triggers" ADD CONSTRAINT "workflow_triggers_workflow_version_id_fkey" FOREIGN KEY ("workflow_version_id") REFERENCES "workflow_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
