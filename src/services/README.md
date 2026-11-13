# services/

Backend abstraction layer. **Projects import only from `src/services` (the `index.ts`
facade), never from a vendor SDK.**

| File                         | Role                                                       |
| ---------------------------- | ---------------------------------------------------------- |
| `types.ts`                   | Interfaces (`ScoreService`, …), shared validation helpers  |
| `local/localScoreService.ts` | Offline implementation (localStorage), the current default |
| `index.ts`                   | Picks the implementation from `VITE_BACKEND`               |

## Selecting a backend

```bash
# .env.local  (or set in the GitHub Actions workflow env)
VITE_BACKEND=local      # default
VITE_BACKEND=supabase   # once implemented
```

`VITE_BACKEND` is inlined at build time, so the branches you don't use are removed
from the bundle.

## Adding a provider (e.g. Supabase)

1. `npm i @supabase/supabase-js` (only now, not before).
2. Add the name to `BackendKind` in `types.ts`.
3. Create `supabase/supabaseScoreService.ts` exporting an object that implements
   `ScoreService`. Read keys from `import.meta.env.VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY` (public anon key only, never a service key).
4. In `index.ts`, replace the `case 'supabase'` body with a **dynamic** import:
   ```ts
   return import('./supabase/supabaseScoreService').then((m) => m.supabaseScoreService);
   ```
   The SDK then lands in its own chunk, downloaded only when a game first reads or
   writes scores, and the hub budget is unaffected.
5. Declare the new env vars in `src/vite-env.d.ts` and `.env.example`.

No project code changes.

## Score validation & anti-cheat (for when the backend arrives)

A static client can always be tampered with. Anything the browser sends is a
claim, not a fact. Plan for these checks on the server:

- **Bounds checking**: reject non-integers, negatives, and scores above a
  per-game maximum. Clamp name length and strip control characters. The client
  helpers in `types.ts` (`assertValidScore`, `sanitizeName`) mirror these rules,
  but the server must enforce them itself (Postgres `CHECK` constraints / RLS in
  Supabase, or validation in a Worker).
- **Rate limiting**: limit submissions per IP or anonymous user (e.g. 1 every
  10 s, 100 a day). Supabase: an Edge Function in front of the insert, or a
  Postgres trigger keyed on `auth.uid()` with anonymous auth. Cloudflare: Rate
  Limiting bindings or a D1 counter.
- **Server-side plausibility check**: submit `meta` (game duration, number of
  inputs, seed, client version) and reject impossible combinations, e.g. a
  Waffle Tower score higher than the drop count allows in the elapsed time. For
  stronger guarantees, record the seed and input log and replay it server-side.
- Never write to the table directly from the client with a privileged key. Allow
  inserts only through a policy or function that runs the checks above.
