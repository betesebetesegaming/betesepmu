import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Will be reimplemented against Firebase Storage in Phase 3.

export async function POST() {
  return NextResponse.json(
    {
      error: 'Not yet implemented',
      detail:
        'program-media-upload is being rewritten against Firebase Storage in Phase 3.',
    },
    { status: 501 }
  );
}
