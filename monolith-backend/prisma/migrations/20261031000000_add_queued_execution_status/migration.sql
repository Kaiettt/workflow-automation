-- Background (webhook) runs wait in the queue as QUEUED until a worker picks them up.
ALTER TYPE "ExecutionStatus" ADD VALUE IF NOT EXISTS 'QUEUED' BEFORE 'RUNNING';
