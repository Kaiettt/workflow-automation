# Quota Reservation Diagnostics

## Requirement

When quota reservation fails, emit a structured server log that distinguishes missing/inactive subscriptions, expired subscriptions, missing active usage periods, and exhausted quota. Include the trigger type and observed subscription status where available. Do not log user identifiers or credentials.

## Acceptance criteria

- AC-1: `NO_ACTIVE_SUBSCRIPTION` logs whether a subscription row was found and its observed status, or `MISSING`.
- AC-2: Other reservation denials log their reason and trigger type; logs do not include user IDs.

## Scenarios

### SC-QUOTA-LOG-01: Subscription missing
Given a user has no subscription row
When quota reservation is attempted
Then the log identifies `no_active_subscription`, `subscriptionFound: false`, and status `MISSING`.

### SC-QUOTA-LOG-02: Subscription not active
Given a user's subscription exists but is not ACTIVE
When quota reservation is attempted
Then the log identifies the observed status and trigger type without logging the user ID.
