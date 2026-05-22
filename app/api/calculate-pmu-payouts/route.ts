import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// The pure pari-mutuel math lives in lib/pmu/calculate.ts and is ready.
// This route is wired up in Phase 3 once Firestore collections for
// bets / results / config / jackpot_carry / payouts are designed.

export async function POST() {
  return NextResponse.json(
    {
      error: 'Not yet implemented',
      detail:
        'PMU payout calculation will be wired up in Phase 3 (Firestore data layer). The math lib at lib/pmu/calculate.ts is ported and ready.',
    },
    { status: 501 }
  );
}
