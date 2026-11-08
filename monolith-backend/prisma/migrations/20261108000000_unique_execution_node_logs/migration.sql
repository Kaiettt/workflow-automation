WITH ranked_logs AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "execution_id", "node_id"
      ORDER BY "finished_at" DESC NULLS LAST, "started_at" DESC, "id" DESC
    ) AS row_number
  FROM "execution_node_logs"
)
DELETE FROM "execution_node_logs"
WHERE "id" IN (
  SELECT "id"
  FROM ranked_logs
  WHERE row_number > 1
);

CREATE UNIQUE INDEX "execution_node_logs_execution_id_node_id_key"
ON "execution_node_logs"("execution_id", "node_id");