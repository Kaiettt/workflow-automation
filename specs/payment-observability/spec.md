# Payment Flow Observability

## Requirements

Add structured operational logs to the existing VNPay payment flow so operators can trace checkout creation, provider IPN processing, and browser return verification.

Logs must include a stable event name, transaction reference when available, relevant amount and resulting status or verification outcome. IPN must log a transaction reference as verified only after signature validation. Never log user identifiers, IP addresses, payment URLs, secrets, signatures, or raw callback payloads.

## Acceptance criteria

- AC-1: A paid checkout emits an event when the pending order and payment URL are created; a failed checkout emits a failure event with the known transaction reference, if any.
- AC-2: Each IPN outcome emits an event covering invalid signature, missing/unknown order, amount mismatch, already-processed order, lost concurrent transition, or successful state transition.
- AC-3: Return verification emits an event with transaction reference, signature validity, provider response code/status, and final success outcome.
- AC-4: Logs contain no raw callback parameters, signature/hash, payment URL, user ID, or IP address.

## Scenarios

### SC-PAY-OBS-01: Checkout succeeds
Given a valid paid plan
When checkout creates an order and provider URL
Then a structured checkout-created event includes transaction reference, plan code, amount, and pending status without user or URL data.

### SC-PAY-OBS-02: IPN rejects an invalid signature
Given an IPN with an invalid signature
When the IPN is handled
Then a structured rejection event is emitted without logging callback contents or unverified payment details.

### SC-PAY-OBS-03: IPN transitions an order
Given a valid signed IPN for a pending order
When its amount is validated and the order transitions
Then a structured event records the transaction reference, amount, response code, and resulting status.

### SC-PAY-OBS-04: Browser return is verified
Given a VNPay return callback
When its signature and result are evaluated
Then a structured return event records the reference and verification outcome without logging signature or callback payload.
