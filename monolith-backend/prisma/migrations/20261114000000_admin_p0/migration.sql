BEGIN;
ALTER TYPE "UserRole" RENAME TO "UserRole_legacy";
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CLIENT');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole"
USING (CASE WHEN "role"::text = 'ADMIN' THEN 'ADMIN' ELSE 'CLIENT' END)::"UserRole";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'CLIENT';
DROP TYPE "UserRole_legacy";
ALTER TABLE "users" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "executions" ADD COLUMN "error_code" VARCHAR(100), ADD COLUMN "cancellation_reason" VARCHAR(100);
ALTER TABLE "execution_node_logs" ADD COLUMN "error_code" VARCHAR(100);
CREATE TABLE "admin_audit_events" (
  "id" UUID NOT NULL, "actor_type" VARCHAR(20) NOT NULL, "actor_id" UUID,
  "action" VARCHAR(100) NOT NULL, "target_id" UUID NOT NULL,
  "target_type" VARCHAR(40) NOT NULL, "reason" VARCHAR(500) NOT NULL,
  "before" JSONB NOT NULL, "after" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_audit_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "admin_audit_events_created_at_id_idx" ON "admin_audit_events"("created_at", "id");
CREATE INDEX "admin_audit_events_target_id_created_at_idx" ON "admin_audit_events"("target_id", "created_at");
CREATE TABLE "session_revocations" (
  "id" UUID NOT NULL, "user_id" UUID NOT NULL, "session_version" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "completed_at" TIMESTAMPTZ,
  CONSTRAINT "session_revocations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "session_revocations_completed_at_created_at_idx" ON "session_revocations"("completed_at", "created_at");
COMMIT;
