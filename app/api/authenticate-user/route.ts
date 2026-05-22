import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Replaced by Firebase Authentication (email/password, phone, Google) in Phase 4.
// Existing custom username/password records are deliberately not migrated.

export async function POST() {
  return NextResponse.json(
    {
      error: 'Endpoint retired',
      detail:
        'Custom authenticate-user has been retired. The new sign-in flow uses Firebase Auth directly from the client (see Phase 4).',
    },
    { status: 410 }
  );
}
