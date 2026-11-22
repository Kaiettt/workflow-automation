CREATE TABLE "node_type_policies" (
  "node_type_key" VARCHAR(150) NOT NULL,
  "is_catalog_visible" BOOLEAN NOT NULL DEFAULT true,
  "is_execution_allowed" BOOLEAN NOT NULL DEFAULT true,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "node_type_policies_pkey" PRIMARY KEY ("node_type_key"),
  CONSTRAINT "node_type_policies_revision_check" CHECK ("revision" >= 0)
);
ALTER TABLE "node_type_policies" ADD CONSTRAINT "node_type_policies_node_type_key_fkey"
FOREIGN KEY ("node_type_key") REFERENCES "node_type_definitions"("key") ON DELETE CASCADE ON UPDATE CASCADE;
