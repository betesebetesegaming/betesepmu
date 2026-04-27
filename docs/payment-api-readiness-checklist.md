# Payment API Readiness Checklist

Use this checklist before sharing integration requirements with Wave/AfriMoney.

## Credentials
- API key (test + production)
- API secret / client secret (test + production)
- Signature secret (for HMAC signing/verification)
- Callback auth token strategy (static token or signed header)

## Merchant Profile
- Merchant ID
- Short code / service code
- Merchant settlement MSISDN
- Merchant display name expected by provider
- Supported currency codes (default: GMD)

## Endpoints
- Base API URL for sandbox
- Base API URL for production
- Payment initiation endpoint path
- Payment status query endpoint path
- Refund/reversal endpoint path (if available)
- Payout/disbursement endpoint path (if available)

## Webhooks
- Your public webhook URL registered with provider
- Provider webhook retry policy (intervals and max retries)
- Provider signature header format and algorithm
- Event types delivered (payment.success, payment.failed, etc.)
- Idempotency key/event ID guarantee

## Operational Rules
- Supported transaction limits (min/max)
- Rate limits and throttling policy
- Timeout recommendations
- Reconciliation report format and schedule
- Error code catalog and retry guidance

## Security & Compliance
- IP allowlist for webhook source addresses
- TLS requirements
- Key rotation process and frequency
- Incident escalation contacts (technical + business)

## Go-Live Gate
- Sandbox validation completed
- End-to-end callback verification completed
- Reconciliation dry run completed
- Production credentials stored in secure server secrets
- Monitoring/alerts configured for failures and webhook backlog
