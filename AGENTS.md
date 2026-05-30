# AGENTS.md

## Cursor Cloud specific instructions

### Architecture overview

- **Frontend**: Next.js 15 (App Router, React 19, Tailwind CSS v4) on port 3000
- **Backend**: Firebase Cloud Functions v2 (Express, TypeScript) — source in `functions/`
- **Databases**: Firestore (primary) + Firebase Realtime Database (payment status sync)
- **Auth**: Firebase Auth
- **Storage**: Firebase Cloud Storage

### Running services locally

1. **Firebase Emulators** (Auth + Firestore + RTDB + Storage + Functions):
   ```bash
   export PATH="$HOME/.npm-global/bin:$PATH"
   firebase emulators:start
   ```
   Emulator UI at http://localhost:4000, Functions at http://localhost:5001.

2. **Next.js dev server**:
   ```bash
   npm run dev
   ```
   Runs on http://localhost:3000.

### Key gotchas

- The frontend **does not** connect to Firebase emulators for Auth/Firestore/RTDB/Storage. It connects to the live Firebase project (`betesepmu-4ffc7`). Only the API calls (`NEXT_PUBLIC_API_BASE_URL`) route to the emulated functions when set to `http://localhost:5001/betesepmu-4ffc7/us-central1/api`.
- `firebase-tools` is installed to `~/.npm-global/bin` (not system-global). You must `export PATH="$HOME/.npm-global/bin:$PATH"` before using `firebase` commands.
- The `functions/package.json` specifies `"engines": {"node": "24"}` but Node 22 LTS works fine locally (only a warning).
- `next lint` requires an `.eslintrc.json` to exist; without it the command prompts interactively. The project has `eslint: { ignoreDuringBuilds: true }` in `next.config.mjs`, so pre-existing lint warnings are expected.
- The `.env.local` file must contain all `NEXT_PUBLIC_FIREBASE_*` vars (values are in the README deploy section).
- `functions/.env` must exist (copy from `functions/.env.example`); payment/SMS keys can be left blank for local emulator testing.

### Standard commands

| Task | Command |
|------|---------|
| Dev server | `npm run dev` |
| Lint | `npm run lint` |
| Typecheck | `npm run typecheck` |
| Build functions | `cd functions && npm run build` |
| Start emulators | `firebase emulators:start` |
| Build frontend | `npm run build` |
