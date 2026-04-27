# Wave API Onboarding Email (Ready To Send)

Subject: Wave API Onboarding Request - Collections and Winner Payouts (Sandbox + Production)

Hello Wave Integration Team,

We are integrating Wave mobile money into our betting platform and need onboarding details for both:
- Collections (customer deposits / cash-in)
- Disbursements (winner payouts / cash-out)

Please share the complete technical and operational information below.

## 1) Environment and Endpoints
- Sandbox base URL
- Production base URL
- Collection initiation endpoint
- Collection status endpoint
- Disbursement initiation endpoint
- Disbursement status endpoint
- Reversal/refund endpoint (if supported)

## 2) Authentication and Security
- API key (sandbox + production)
- Client/API secret (sandbox + production)
- Signature secret or signing method
- Required auth headers and token format
- Signature algorithm and canonical string rules
- Timestamp/nonce requirements

## 3) Merchant Profile Information
- Merchant ID
- Short code/service code
- Merchant MSISDN/wallet account
- Merchant display name visible to customers
- Supported currency codes (please confirm GMD)

## 4) Webhooks and Callback Contract
- Callback registration process
- Event types for collection and disbursement
- Sample callback payloads (JSON)
- Signature header name and verification method
- Retry policy (attempts and intervals)
- Idempotency/event unique ID behavior

## 5) Limits, Errors, and Reliability
- Min/max amount per collection and disbursement
- Rate limits/throughput limits
- Timeout recommendations
- Full error code catalog with retry guidance
- Maintenance and outage communication process

## 6) Reconciliation and Settlement
- Settlement cycle/cutoff times
- Reconciliation report format and delivery method
- Failed transaction reconciliation procedure
- Dispute/chargeback process and SLA

## 7) Go-Live Process
- Sandbox certification test cases
- Production activation prerequisites
- Technical support and escalation contacts
- Key rotation process

For faster onboarding, our callback details are:
- Sandbox webhook URL: [YOUR_SANDBOX_WEBHOOK_URL]
- Production webhook URL: [YOUR_PRODUCTION_WEBHOOK_URL]
- Callback auth mode expected by us: Bearer token and/or signature validation

Please also confirm that disbursement (winner payout) is enabled on our merchant profile at onboarding.

Company details:
- Company name: [YOUR_COMPANY_NAME]
- Product name: Betese PMU
- Country: [YOUR_COUNTRY]
- Technical contact: [NAME, EMAIL, PHONE]
- Business contact: [NAME, EMAIL, PHONE]

Thank you,
[YOUR_NAME]
[TITLE]
[COMPANY]
