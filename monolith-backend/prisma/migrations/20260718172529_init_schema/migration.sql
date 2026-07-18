-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'DEVELOPER', 'BUSINESS_USER');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "NodeCategory" AS ENUM ('TRIGGER', 'LOGIC', 'DATA_PROCESSING', 'INTEGRATION');

-- CreateEnum
CREATE TYPE "ConnectorAuthType" AS ENUM ('NONE', 'API_KEY', 'OAUTH2', 'BASIC');

-- CreateEnum
CREATE TYPE "ConnectorTestStatus" AS ENUM ('UNTESTED', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "TriggerType" AS ENUM ('SCHEDULE', 'WEBHOOK', 'MANUAL');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NodeExecutionStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'SKIPPED', 'TIMEOUT');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'DEVELOPER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflows" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "owner_id" UUID NOT NULL,
    "current_version_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_drafts" (
    "workflow_id" UUID NOT NULL,
    "definition" JSONB NOT NULL DEFAULT '{}',
    "validation_errors" JSONB,
    "locked_by_id" UUID,
    "locked_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "workflow_drafts_pkey" PRIMARY KEY ("workflow_id")
);

-- CreateTable
CREATE TABLE "workflow_versions" (
    "id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "definition" JSONB NOT NULL,
    "published_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "node_type_definitions" (
    "id" UUID NOT NULL,
    "key" VARCHAR(150) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "category" "NodeCategory" NOT NULL,
    "description" TEXT,
    "config_schema" JSONB NOT NULL,
    "connector_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "node_type_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connectors" (
    "id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "auth_type" "ConnectorAuthType" NOT NULL,
    "config_schema" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connector_credentials" (
    "id" UUID NOT NULL,
    "connector_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "encrypted_secret" TEXT NOT NULL,
    "last_tested_at" TIMESTAMPTZ,
    "last_test_status" "ConnectorTestStatus" NOT NULL DEFAULT 'UNTESTED',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "connector_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "executions" (
    "id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "workflow_version_id" UUID NOT NULL,
    "trigger_type" "TriggerType" NOT NULL,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'RUNNING',
    "triggered_by_id" UUID,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ,
    "duration_ms" INTEGER,

    CONSTRAINT "executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_node_logs" (
    "id" UUID NOT NULL,
    "execution_id" UUID NOT NULL,
    "node_id" VARCHAR(100) NOT NULL,
    "node_key" VARCHAR(150) NOT NULL,
    "status" "NodeExecutionStatus" NOT NULL DEFAULT 'RUNNING',
    "input" JSONB,
    "output" JSONB,
    "error_message" TEXT,
    "error_stack" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ,
    "duration_ms" INTEGER,

    CONSTRAINT "execution_node_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "workflows_current_version_id_key" ON "workflows"("current_version_id");

-- CreateIndex
CREATE INDEX "workflows_owner_id_idx" ON "workflows"("owner_id");

-- CreateIndex
CREATE INDEX "workflows_status_idx" ON "workflows"("status");

-- CreateIndex
CREATE INDEX "workflow_versions_workflow_id_idx" ON "workflow_versions"("workflow_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_versions_workflow_id_version_number_key" ON "workflow_versions"("workflow_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "node_type_definitions_key_key" ON "node_type_definitions"("key");

-- CreateIndex
CREATE INDEX "node_type_definitions_category_idx" ON "node_type_definitions"("category");

-- CreateIndex
CREATE UNIQUE INDEX "connectors_key_key" ON "connectors"("key");

-- CreateIndex
CREATE INDEX "connector_credentials_connector_id_owner_id_idx" ON "connector_credentials"("connector_id", "owner_id");

-- CreateIndex
CREATE INDEX "executions_workflow_id_started_at_idx" ON "executions"("workflow_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "executions_status_idx" ON "executions"("status");

-- CreateIndex
CREATE INDEX "execution_node_logs_execution_id_idx" ON "execution_node_logs"("execution_id");

-- CreateIndex
CREATE INDEX "execution_node_logs_execution_id_status_idx" ON "execution_node_logs"("execution_id", "status");

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "workflow_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_drafts" ADD CONSTRAINT "workflow_drafts_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_drafts" ADD CONSTRAINT "workflow_drafts_locked_by_id_fkey" FOREIGN KEY ("locked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_published_by_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "node_type_definitions" ADD CONSTRAINT "node_type_definitions_connector_id_fkey" FOREIGN KEY ("connector_id") REFERENCES "connectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_credentials" ADD CONSTRAINT "connector_credentials_connector_id_fkey" FOREIGN KEY ("connector_id") REFERENCES "connectors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connector_credentials" ADD CONSTRAINT "connector_credentials_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executions" ADD CONSTRAINT "executions_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executions" ADD CONSTRAINT "executions_workflow_version_id_fkey" FOREIGN KEY ("workflow_version_id") REFERENCES "workflow_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executions" ADD CONSTRAINT "executions_triggered_by_id_fkey" FOREIGN KEY ("triggered_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_node_logs" ADD CONSTRAINT "execution_node_logs_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
