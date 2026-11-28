# Verified Payment Return Settlement

## Requirements

A valid VNPay browser return must be verified and processed by the backend before redirecting the client to the payment result page. The frontend continues to display the persisted order status and cannot declare success from browser-supplied data.

The return callback and VNPay IPN must share the existing idempotent order transition, amount validation, and durable completion outbox behavior. Invalid signatures must never reach settlement. Keep IPN enabled for payments where the customer does not return to the application.

## Acceptance criteria

- AC-1: A signed successful browser return with a matching pending order and amount transitions the order to COMPLETED before the redirect; the existing outbox transition remains atomic.
- AC-2: A signed failed browser return with matching order and amount transitions the order to FAILED.
- AC-3: Invalid signatures never dispatch settlement.
- AC-4: Return and IPN callbacks remain idempotent if both arrive, and log events identify the callback source.
- AC-5: The payment result page continues to rely only on the persisted order API status.

## Scenarios

### SC-PAY-RETURN-01: Successful return settles before redirect
Given a pending payment order and a signed successful VNPay return with a matching amount
When the backend handles the return
Then it runs the same validated idempotent settlement as IPN before redirecting the browser.

### SC-PAY-RETURN-02: Invalid return is not settled
Given a VNPay return with an invalid signature
When the backend handles the return
Then it does not invoke order settlement and the order remains unchanged.

### SC-PAY-RETURN-03: IPN duplicates a settled return
Given a return has already transitioned the order
When VNPay later sends the IPN for that payment
Then the conditional transition prevents duplicate completion processing.
