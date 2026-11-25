-- Global Admin list; the existing workflow/queued_at/id index already covers workflow filters.
CREATE INDEX "executions_queued_at_id_idx" ON "executions"("queued_at" DESC, "id" DESC);
CREATE INDEX "executions_status_queued_at_id_idx" ON "executions"("status", "queued_at" DESC, "id" DESC);
