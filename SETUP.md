# Husky Share

UW peer lending / selling / giveaway app — INFO 442 B, Autumn 2026.

**Stack:** React 18 + Vite · Firebase (Firestore + Auth) · React Router · ESLint

## Getting started (every teammate)

Requirements: **Node 20+** and **Java 11+** (Java is only needed for the local Firebase emulators).

```bash
git clone <repo-url>
cd husky-share
npm install
cp .env.example .env.local      # keep VITE_USE_EMULATORS=true for local work
```

Run the app against the local database (two terminals):

```bash
npm run emulators   # terminal 1 — Firestore + Auth emulators, UI at http://127.0.0.1:4000
npm run dev         # terminal 2 — app at http://localhost:5173
```

## Verifying Issue 1.1

1. **App runs:** open http://localhost:5173 — the Husky Share home page loads.
2. **DB save + retrieve (browser):** go to http://localhost:5173/dev/db-check → click **Save and read back** → a green "Saved and retrieved document …" message appears. The document is also visible in the emulator UI under `healthChecks`.
3. **DB save + retrieve (command line):**
   ```bash
   npx firebase emulators:exec --only firestore "npm run test:db"
   ```
   Prints `PASS: saved and retrieved …`.
4. **Code quality (NF10):** `npm run lint` finishes with no errors.

## Connecting the real Firebase project (one person, once)

1. Firebase console → create project → add a **Web app** → copy its config into `.env.local`.
2. Firestore Database → Create database (production mode).
3. Authentication → enable **Google** sign-in (used in Issue 1.2).
4. Set `VITE_USE_EMULATORS=false` in `.env.local`, then:
   ```bash
   npx firebase login
   npx firebase use --add          # pick the project
   npx firebase deploy --only firestore:rules
   ```
5. Share the config values with the team privately (not in Git — `.env.local` is gitignored).

Deploying with Firebase Hosting (`npm run build && npx firebase deploy --only hosting`) serves the site over HTTPS only (NF6).

## Project structure

```
firestore.rules          Security rules — only signed-in, verified @uw.edu users can access data (NF7)
firebase.json            Firestore, Hosting and emulator config
src/firebase.js          Firebase init; switches to emulators when VITE_USE_EMULATORS=true
src/data/schema.js       Collection names, status values, and document shapes (from the logical data model)
src/data/healthCheck.js  Save + read-back test used by Issue 1.1
src/pages/               Pages (Home, DbCheck for now)
scripts/db-check.js      Command-line DB check
```

## Database collections

Based on the *Husky Share – Logical Data Model*. Full field list is in `src/data/schema.js`.

| Collection | Holds |
|---|---|
| `users` | Profile, UW email, total points, rating totals |
| `pickupAreas` | Named pickup spots with map coordinates |
| `listings` | Lend / Sell / Give items, with status Active / Unavailable / Inactive |
| `requests` | Borrow / buy / free requests, status + transaction stage |
| `confirmationPhotos` | Pickup and return photos |
| `ratings` | 1–5 stars + tags per transaction |
| `pointsRecords` | One doc per completed request (doc id = request id, prevents double points) |
| `healthChecks` | Setup test docs only — remove its open rule after Issue 1.2 |

## Team conventions

- Branch per issue: `issue-1.2-uw-verification`, then open a PR to `main`.
- Run `npm run lint` before pushing.
- Import collection names and statuses from `src/data/schema.js` — don't hard-code strings.
