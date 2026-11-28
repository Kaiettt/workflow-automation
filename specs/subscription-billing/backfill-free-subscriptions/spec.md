# Backfill Free Subscriptions

## Requirements

The Prisma seed command must assign a Free subscription to every existing user row that has no subscription. Include all roles. Create an ACTIVE subscription and its current 30-day usage period using the Free plan's configured quota. Preserve every existing subscription and make repeated seed runs safe. Seed the Free plan before running the backfill.

## Acceptance criteria

- AC-1: Every user without a subscription receives an ACTIVE Free subscription and a usage period with the plan quota.
- AC-2: Existing subscriptions, including paid, expired, or cancelled subscriptions, are not modified.
- AC-3: Re-running the seed does not create duplicate subscriptions or usage periods.
- AC-4: If the Free plan is missing, fail clearly without creating partial records.

## Scenarios

### SC-FREE-SEED-01: Backfill users without subscriptions
Given a Free plan and users without subscription rows
When the subscription backfill seed runs
Then each such user receives an ACTIVE Free subscription and a 30-day quota period for the Free plan quota.

### SC-FREE-SEED-02: Preserve existing subscriptions
Given users who already have subscriptions
When the backfill seed runs
Then their current plan, status, and usage remain unchanged.

### SC-FREE-SEED-03: Idempotent repeated seed
Given the backfill has already run
When it runs again
Then it creates no additional subscriptions or usage periods.
