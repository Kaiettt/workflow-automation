-- CreateTable
CREATE TABLE "connector_policies" (
    "connector_id" UUID NOT NULL,
    "allow_new_credentials" BOOLEAN NOT NULL DEFAULT true,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connector_policies_pkey" PRIMARY KEY ("connector_id")
);

-- AddForeignKey
ALTER TABLE "connector_policies" ADD CONSTRAINT "connector_policies_connector_id_fkey" FOREIGN KEY ("connector_id") REFERENCES "connectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

