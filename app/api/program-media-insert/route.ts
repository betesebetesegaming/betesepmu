import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Will be reimplemented against Firestore (`program_images` collection) in Phase 3.

export async function POST() {
  return NextResponse.json(
    {
      error: 'Not yet implemented',
      detail:
        'program-media-insert is being rewritten against Firestore in Phase 3.',
    },
    { status: 501 }
  );
}
