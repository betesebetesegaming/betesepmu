<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/8a0a6433-a001-4676-ac57-90372e4ae581

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

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
