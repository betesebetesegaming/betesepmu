<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/8a0a6433-a001-4676-ac57-90372e4ae581

## Printer Support

**Supported Thermal Printers:**
- ✅ **Sunmi built-in** - Native AIDL service (recommended for Sunmi v2Pro)
- ✅ **Mate Bluetooth Printer** - External Bluetooth thermal printer
- ✅ **Bluetooth Thermal Print** - Generic Bluetooth printers
- ✅ **RawBT** - RawBT Android app support
- ✅ **Android native** - System print dialog fallback

**Setup Guide:** See [MATE_BLUETOOTH_PRINTER_SETUP.md](docs/MATE_BLUETOOTH_PRINTER_SETUP.md) for Sunmi v2Pro with Mate app integration.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Sunmi Performance Benchmark

Use this to compare startup and memory between normal APK and lite APK on a real Sunmi terminal.

Prerequisites:

- USB debugging enabled on the device
- `adb` available in terminal (`adb devices` must show one device)

Commands:

- Full build package benchmark:
   `npm run sunmi:bench:full`
- Lite build package benchmark:
   `npm run sunmi:bench:lite`
- No-device proxy benchmark (build + APK internals comparison):
   `npm run sunmi:bench:proxy`
- Local macrobenchmark on connected Android:
   `npm run sunmi:bench:macro`

The script runs cold starts, prints per-run `ThisTime`, `TotalTime`, `WaitTime`, and a `dumpsys meminfo` PSS snapshot, then shows averages.

Optional direct script usage:

`powershell -ExecutionPolicy Bypass -File scripts/sunmi-benchmark.ps1 -PackageName com.betese.pmu.poslite -Runs 7 -ClearData`

If you do not have Sunmi connected over ADB, use:

`powershell -ExecutionPolicy Bypass -File scripts/sunmi-proxy-benchmark.ps1`

This generates:

`docs/sunmi-proxy-benchmark-report.md`

## Remote Real-Device Benchmark (No USB)

A GitHub Actions workflow is included to run Android Macrobenchmark on Firebase Test Lab:

`.github/workflows/android-macrobenchmark.yml`

Set these repository secrets before running:

- `GCP_PROJECT_ID`
- `GCP_SA_KEY` (service account JSON with Firebase Test Lab permissions)

How to run:

1. Open Actions tab in GitHub.
2. Run `Android Macrobenchmark (Firebase Test Lab)`.
3. Choose target: `full` or `lite`.
4. Keep defaults (`oriole`, API `33`) or pick another device/API.

The workflow builds both APK variants, runs macrobenchmark startup tests remotely, and stores results in Firebase Test Lab under:

`macrobenchmark/<github-run-id>-<target>`

## PMU Pari-Mutuel Payout Engine

This repository now includes a full PMU-style payout module with:

- Separate pools per bet type (`gagnant`, `place`, `couple`, `tierce`, `quarte`, `quinte`, `multi4`-`multi7`)
- Configurable payout percentages (for example 75% or 80%)
- Per bet-type ON/OFF switch (`is_enabled`) so you can choose what to use each day
- Per bet-type mode switch (`calculation_mode`): `automatic` or `manual`
- Split rules by winning level
- Winner classification priority (`order` -> `disorder` -> `bonus`)
- Jackpot carry forward when no winners
- Minimum dividend and rounding controls
- Live preview and finalize in back office

### 1) Run SQL schema in Supabase

Execute:

`supabase/pmu_schema.sql`

This now creates both:

- PMU payout engine tables (`bets`, `results`, `config`, `payouts`, `jackpot_carry`)
- Core app tables and transaction functions (`users`, `races`, `tickets`, `deposit_requests`, `withdrawal_requests`, `promotions`, `program_images`, `payment_configs`, `chat_threads`, `chat_messages`, `manual_bet_orders`)

It also installs DB transaction functions used by the app:

- `payout_ticket_transaction`
- `approve_deposit_transaction`
- `pay_for_booking_transaction`
- `process_withdrawal_request_transaction`
- `mark_message_thread_read`

### 1.1) Required frontend env vars

Create `.env.local` with:

`VITE_SUPABASE_URL=your_supabase_project_url`

`VITE_SUPABASE_ANON_KEY=your_supabase_anon_key`

Without these values, the app will run disconnected from Supabase.

### 2) Netlify function

Serverless function path:

`netlify/functions/calculate-pmu-payouts.js`

AI support function path:

`netlify/functions/support-ai.js`

Program media fallback functions (for storage/table RLS environments):

`netlify/functions/program-media-upload.js`

`netlify/functions/program-media-insert.js`

Required Netlify environment variables:

- `SUPABASE_URL` (or `VITE_SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY` (required for AI diagnosis in Support panel)
- `OPENAI_MODEL` (optional, default: `gpt-4o-mini`)

Optional frontend override:

- `VITE_SUPPORT_AI_WEBHOOK` (defaults to `/.netlify/functions/support-ai` if not set)

### 3) Admin back-office payout box

In Admin dashboard, open:

`PMU Dividend Engine`

You can:

- Enter result positions
- Click `CALCULATE (Preview)` to see payout by type/level
- Click `FINALIZE PAYOUTS` to store payouts and jackpot carry
- Turn specific bet types ON/OFF before calculation
- Choose manual or automatic per bet type before calculation
- Edit payout percentages and split ratios
- Apply manual dividend overrides

### API details

See:

`docs/pmu-api.md`
