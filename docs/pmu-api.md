# PMU Payout API Structure

## Endpoint
- POST /.netlify/functions/calculate-pmu-payouts

## Request Body
```json
{
  "race_id": "RACE-2026-04-21-1",
  "mode": "preview",
  "positions": [4, 7, 2, 8, 1]
}
```

Fields:
- race_id: required
- mode: preview | finalize
- positions: optional in preview if already stored in results table; required for first run

## Response
```json
{
  "race_id": "RACE-2026-04-21-1",
  "mode": "preview",
  "positions": [4, 7, 2, 8, 1],
  "rows": [
    {
      "race_id": "RACE-2026-04-21-1",
      "bet_type": "tierce",
      "level": "order",
      "pool": 3500,
      "winners": 22,
      "winner_tickets": 10,
      "dividend": 160,
      "carry_in": 0,
      "carry_out": 0
    }
  ]
}
```

## Logic Summary
- Total pool per bet type:
  - TOTAL_POOL = sum(stake * units)
- Payout pool per bet type:
  - PAYOUT_POOL = TOTAL_POOL * payout_percentage
- Split by level from config.split_rules
- Bet type enable switch:
  - config.is_enabled = false -> that bet type is ignored by calculation/finalization
- Bet type calculation mode:
  - config.calculation_mode = automatic -> system computes dividend
  - config.calculation_mode = manual -> system keeps dividend blank for manual payout entry/override
- Winner classification priority:
  - order first
  - disorder second
  - bonus levels last
- Dividend per level:
  - DIVIDEND = level_pool / total_winning_units
  - minimum dividend applied
  - rounded to nearest rounding_base (default 5)
- No winner behavior:
  - if jackpot_enabled = true, carry amount stored in jackpot_carry

## Supporting Tables
- bets
- results
- config
- payouts
- jackpot_carry
