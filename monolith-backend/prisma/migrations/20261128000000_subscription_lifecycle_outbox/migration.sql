CREATE TABLE "billing_outbox_events" (
    "id" UUID NOT NULL,
    "idempotency_key" VARCHAR(128) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "processed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "billing_outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subscription_payment_fulfillments" (
    "id" UUID NOT NULL,
    "order_code" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subscription_payment_fulfillments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "billing_outbox_events_idempotency_key_key"
    ON "billing_outbox_events"("idempotency_key");
CREATE INDEX "billing_outbox_events_processed_at_created_at_idx"
    ON "billing_outbox_events"("processed_at", "created_at");
CREATE UNIQUE INDEX "subscription_payment_fulfillments_order_code_key"
    ON "subscription_payment_fulfillments"("order_code");
