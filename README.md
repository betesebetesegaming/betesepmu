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

### 2) Netlify function

Serverless function path:

`netlify/functions/calculate-pmu-payouts.js`

Required Netlify environment variables:

- `SUPABASE_URL` (or `VITE_SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE_KEY`

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
