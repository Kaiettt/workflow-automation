ALTER TABLE "executions"
ADD COLUMN "queued_at" TIMESTAMPTZ,
ADD COLUMN "idempotency_key" VARCHAR(128);

UPDATE "executions"
SET "queued_at" = "started_at";

ALTER TABLE "executions"
ALTER COLUMN "queued_at" SET NOT NULL,
ALTER COLUMN "queued_at" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "started_at" DROP NOT NULL;

CREATE INDEX "executions_workflow_id_queued_at_id_idx"
ON "executions"("workflow_id", "queued_at" DESC, "id" DESC);

CREATE UNIQUE INDEX "executions_triggered_by_id_idempotency_key_key"
ON "executions"("triggered_by_id", "idempotency_key");