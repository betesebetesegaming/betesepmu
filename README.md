<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Betese PMU

Next.js front-end + Firebase backend for the Betese PMU horse-betting platform.

| Layer | Stack |
| --- | --- |
| Web app | Next.js 15 (static export) |
| Mobile | Capacitor (Android APK in `android/`) |
| Auth | Firebase Auth |
| Database | Firestore + Realtime Database |
| Storage | Firebase Cloud Storage |
| Backend | Firebase Cloud Functions v2 (Node 20, Express) |
| Payments | Modem Pay (Wave / APS / AfriMoney / QMoney / Card) |

## Printer Support

- ✅ **Sunmi built-in** — Native AIDL service (recommended for Sunmi v2Pro)
- ✅ **Mate Bluetooth Printer** — External Bluetooth thermal printer
- ✅ **Bluetooth Thermal Print** — Generic Bluetooth printers
- ✅ **RawBT** — RawBT Android app support
- ✅ **Android native** — System print dialog fallback

Setup guide: [MATE_BLUETOOTH_PRINTER_SETUP.md](docs/MATE_BLUETOOTH_PRINTER_SETUP.md).

## Run locally

Prerequisites: **Node 20**, Firebase CLI (`npm install -g firebase-tools`).

```powershell
# Front-end
npm install
copy .env.local.example .env.local   # then fill in the blanks
npm run dev                          # Next.js dev server on :3000
```

To exercise the backend locally use the Firebase emulator suite (functions +
Firestore + RTDB + Storage + Auth):

```powershell
cd functions
npm install
npm run build
cd ..
firebase emulators:start
# Emulator UI:    http://localhost:4000
# Functions URL:  http://localhost:5001/betesepmu-4ffc7/us-central1/api
```

Point the front-end at the emulator by setting `NEXT_PUBLIC_API_BASE_URL`
in `.env.local`:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:5001/betesepmu-4ffc7/us-central1/api
```

## Deploy

The front-end ships to **Vercel** (via GitHub auto-deploy on push to `main`).
Only the backend (Cloud Functions + Firestore / RTDB / Storage rules) ships to
**Firebase**.

### 1. Front-end → Vercel

The Vercel project is already wired to the GitHub repo. On every push to
`main` Vercel runs `next build` and rolls out automatically.

Set these env vars in **Vercel → Project Settings → Environment Variables**
(Production + Preview):

| Key | Value |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | `https://us-central1-betesepmu-4ffc7.cloudfunctions.net` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `AIzaSyBc9gCvUCGXxscMGVLwaOJHv9I75E_3pns` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `betesepmu-4ffc7.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_DATABASE_URL` | `https://betesepmu-4ffc7-default-rtdb.firebaseio.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `betesepmu-4ffc7` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `betesepmu-4ffc7.firebasestorage.app` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `564957052051` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `1:564957052051:web:5df2b5268d17d6ec786166` |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | `G-7LJGW9ED0R` |
| `NEXT_PUBLIC_MODEMPAY_PUBLIC_KEY` | `pk_live_4831da13e43954a46b9ef60cdabf02e7502b1814ee140d8497bff80af5bb51a6` |

Trigger a redeploy from Vercel after adding the keys so they take effect.

### 2. Backend → Firebase

Copy `functions/.env.example` to `functions/.env` and fill in server-only
credentials (ModemPay and Africell SMS for the dormant OTP functions). Firebase loads that file
automatically on deploy — no `firebase functions:secrets:set` step needed.

```powershell
npm install -g firebase-tools

firebase login
firebase use betesepmu-4ffc7

cd functions
copy .env.example .env
npm install
npm run build
cd ..

firebase deploy --only functions,firestore,storage,database
```

After the first deploy, register the webhook URL in the Modem Pay dashboard
(Developers → Webhooks):

```
https://us-central1-betesepmu-4ffc7.cloudfunctions.net/modempayWebhook
```

Paste the webhook secret into `functions/.env` as `MODEMPAY_WEBHOOK_SECRET`, then
redeploy:

```powershell
firebase deploy --only functions
```

> The support-AI endpoint uses **Vertex AI Gemini** via Application Default
> Credentials — no API key needed. Just grant the Cloud Functions service
> account the **Vertex AI User** role once (see below).

### 3. One-time GCP setup (Vertex AI access)

```bash
gcloud projects add-iam-policy-binding betesepmu-4ffc7 \
  --member="serviceAccount:564957052051-compute@developer.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

> If App Engine is enabled on your project, use
> `betesepmu-4ffc7@appspot.gserviceaccount.com` instead. Cloud Functions Gen 2
> defaults to the Compute Engine service account when App Engine is not set up.

Or use the GCP Console → IAM → grant `roles/aiplatform.user` to
`564957052051-compute@developer.gserviceaccount.com`.

## Firebase Functions endpoints

Each route is its own Cloud Function. Public base URL:

```
https://us-central1-betesepmu-4ffc7.cloudfunctions.net
```

| Function | Route (legacy) | Purpose |
| --- | --- | --- |
| `sendOtp` | `POST /send-otp` | Africell SMS OTP (deployed; signup not wired until gateway is fixed) |
| `verifyOtp` | `POST /verify-otp` | Verifies hashed Africell OTP |
| `modempayCheckout` | `POST /modempay-checkout` | Unified hosted-checkout (wave / aps / afrimoney / qmoney / card) |
| `wavePayment` | `POST /wave-payment` | Alias for wave |
| `apsPayment` | `POST /aps-payment` | Alias for aps |
| `afrimoneyPayment` | `POST /afrimoney-payment` | Alias for afrimoney |
| `qmoneyPayment` | `POST /qmoney-payment` | Alias for qmoney |
| `cardPayment` | `POST /card-payment` | Alias for card |
| `modempayPayout` | `POST /modempay-payout` | Wallet → mobile-money payout (used for withdrawals) |
| `modempayRefund` | `POST /modempay-refund` | Refund a transaction |
| `modempayBalances` | `GET /modempay-balances` | Available + payout balances |
| `modempayTransactions` | `GET /modempay-transactions/:id` | Single transaction lookup |
| `modempayWebhook` | `POST /modempay-webhook` | HMAC-SHA512 verified webhook receiver |
| `calculatePmuPayouts` | `POST /calculate-pmu-payouts` | Pari-mutuel dividend engine |
| `programMediaUpload` | `POST /program-media-upload` | Race-programme media upload to Cloud Storage |
| `programMediaInsert` | `POST /program-media-insert` | Firestore registration for uploaded media |
| `supportAi` | `POST /support-ai` | Vertex AI Gemini support diagnostics |
| `printReceipt` | `GET /print-receipt` | Thermer Browser-Print response endpoint |

## PMU pari-mutuel payout engine

The pure dividend math is in [`lib/pmu/calculate.ts`](lib/pmu/calculate.ts) and
runs server-side via `POST /api/calculate-pmu-payouts`. Features:

- Separate pools per bet type (`gagnant`, `place`, `couple`, `tierce`, `quarte`,
  `quinte`, `multi4`–`multi7`).
- Configurable payout percentages (e.g. 75% / 80%).
- Per bet-type on/off (`is_enabled`) and per bet-type mode (`automatic` /
  `manual`).
- Split rules by winning level.
- Winner classification priority (`order` → `disorder` → `bonus`).
- Jackpot carry forward when no winners.
- Minimum dividend + rounding controls.

In the Admin dashboard, open **PMU Dividend Engine** to preview and finalise
payouts; see [`docs/pmu-api.md`](docs/pmu-api.md) for details.

## Sunmi performance benchmark

See [`PERFORMANCE_OPTIMIZATION_GUIDE.md`](PERFORMANCE_OPTIMIZATION_GUIDE.md) for
detailed startup / memory benchmarks on Sunmi terminals.

Quick commands:

- `npm run sunmi:bench:full`  — full build benchmark
- `npm run sunmi:bench:lite`  — lite build benchmark
- `npm run sunmi:bench:proxy` — build + APK internals comparison (no device)
- `npm run sunmi:bench:macro` — macrobenchmark on a connected Android

A GitHub Actions workflow under `.github/workflows/android-macrobenchmark.yml`
runs the same benchmark on Firebase Test Lab.
