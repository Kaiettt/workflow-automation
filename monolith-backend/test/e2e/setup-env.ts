// E2E runs use their own BullMQ key space, so a dev server sharing the same
// Redis does not pick up (and run) the jobs these tests enqueue.
process.env['BULLMQ_PREFIX'] = process.env['BULLMQ_PREFIX'] || 'flowpilot-e2e';
