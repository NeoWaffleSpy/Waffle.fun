# Waffle.fun

A hub of small, self-contained interactive mini-projects (some 3D, some 2D), in the
spirit of neil.fun. Static site, hosted free on GitHub Pages.

- **Planet Forge** (3D): a procedural planet and its moons, generated entirely in
  shaders from a seed. Orbit controls, "new seed", sea level, shareable
  `#/planet?seed=1234` URLs. Zero downloaded assets.
- **Gravity Courier** (3D game): deliver cargo across a procedural star system with
  gravity slingshots. Daily shared route, trajectory forecast, ghost replays,
  synthesized audio, per-system leaderboards. Its planets and moons come from the
  Planet Forge generator.
- **Waffle Tower** (2D): a Canvas 2D stacking game with a local high-score list
  via `ScoreService`. Never loads three.js.

Stack: Vite 8 (Rolldown) · React 19 · TypeScript 6 (strict) · React Three Fiber 9 +
drei · Zustand · vite-plugin-pwa · GitHub Actions → Pages.

---

## Running locally

Requires Node 20+ (CI uses 24).

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # type-check + production build into dist/
npm run size         # bundle budget check (run after build)
npm run preview      # serve dist/ locally
npm run analyze      # build + dist/stats.html treemap (rollup-plugin-visualizer)
npm run lint         # ESLint (typescript-eslint strict-type-checked)
npm run format       # Prettier
npm test             # Vitest: world generator, sim determinism, replay codec
```

To preview exactly what Pages will serve (under a sub-path), build and preview with
the same base:

```bash
BASE_PATH=/Waffle.fun/ npm run build && BASE_PATH=/Waffle.fun/ npm run preview
# → http://localhost:4173/Waffle.fun/
```

---

## Project layout

```
src/
  main.tsx               entry: mounts <App/>
  App.tsx                routes derived from the registry (#/ → hub, #/<slug> → project)
  Hub.tsx                home grid, no 3D, hover/focus prefetch
  styles.css             global + hub styles
  projects/
    registry.ts          single source of truth for all projects
    planet/              3D: Planet Forge UI over the shared world generator (+ moons)
    gravity-courier/     3D game
      sim/               deterministic simulation, route planner, replay codec, verifier
      scene/             R3F scene: one fixed-step loop, interpolated rendering
      ui/                menu, HUD, results, touch controls
    waffle-tower/        2D: canvas engine, store
  shared/
    components/          ProjectRoute shell, Loader, ErrorBoundary, HighScores, WebGL fallback
    hooks/               reduced motion, WebGL2 detection (no three import), document title
    worlds/              world + moon + star-system generators, deterministic math (no three)
    three/               SceneCanvas, GLSL noise, worlds/ (PlanetBody, StarBody, Starfield,
                         OrbitRing, planet shaders). 3D projects only!
    router.tsx           ~1 KB hash router
    random.ts            seeded PRNG
  services/              backend abstraction (see services/README.md)
scripts/size-report.mjs  budget checker (walks the real chunk graph)
```

---

## Adding a new mini-project

1. **Create the folder** `src/projects/<slug>/index.tsx` with a default-exported
   component:

   ```tsx
   import './my-thing.css'; // optional, split into this project's chunk

   export default function MyThing() {
     return <div className="my-thing">Hello</div>;
   }
   ```

   - The shell already gives you a full-viewport `<main>`, a back button, Suspense,
     an error boundary and (for 3D) a WebGL check. Position your root `absolute;
inset: 0`.
   - Keep state inside the folder (e.g. a local `store.ts` with Zustand). Never import
     from another project.
   - Clean up on unmount: cancel `requestAnimationFrame`, remove listeners, stop
     audio, `dispose()` any three.js objects you created with `new` (R3F disposes
     the ones it creates from JSX).
   - Respect `usePrefersReducedMotion()`.

2. **Register it** in `src/projects/registry.ts`:

   ```ts
   {
     slug: 'my-thing',                 // must match the folder name
     title: 'My Thing',
     description: 'One sentence.',
     tags: ['2D', 'toy'],
     is3D: false,                      // true → WebGL check + uses the shared 3D vendor chunk
     thumbnail: {
       background: 'linear-gradient(135deg, #f6c46b, #d98b2b)', // CSS, no image download
       alt: 'Describe the thumbnail for screen readers',
     },
     load: () => import('./my-thing'),
   },
   ```

3. `npm run build && npm run size`. The report lists your chunk, its size against the
   50 KB budget, and whether it pulls three.js.

That's it: the route, hub card, prefetching and code splitting come from the
registry entry.

**3D projects:** use `SceneCanvas` from `shared/three/SceneCanvas` (defaults to
`frameloop="demand"`; pass `"always"` only while something animates), and call
`invalidate()` after changing uniforms in demand mode. Reuse the GLSL chunks in
`shared/three/noise.glsl.ts`.

---

## CI/CD (GitHub Actions)

| Workflow                       | Runs on                    | What it does                                                        |
| ------------------------------ | -------------------------- | ------------------------------------------------------------------- |
| `.github/workflows/ci.yml`     | every pull request, manual | quality + build/budgets + Lighthouse (three parallel jobs)          |
| `.github/workflows/deploy.yml` | push to `main`, manual     | calls `ci.yml`, then deploys to Pages **only if every gate passes** |
| `.github/dependabot.yml`       | weekly (Monday)            | grouped dependency + action update PRs, each one runs CI            |

CI gates (the same for PRs and `main`):

1. **Lint, format & types**: `npm run lint`, `npm run format:check`, `npm run typecheck`.
2. **Build & bundle budgets**: production build, then `npm run size`. Fails if the
   hub goes over 80 KB, a project over 50 KB, or a 2D project reaches three.js. The
   size table is posted to the run's job summary, so every PR shows its bundle
   impact.
3. **Lighthouse**: [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
   runs the hub 3 times. Performance and accessibility must score ≥ 90 (median);
   best practices and SEO below 90 only warn. Thresholds live in
   `lighthouserc.json`. HTML reports are attached to the run as artifacts (not
   uploaded publicly).

Node version comes from `.nvmrc` (24), so `nvm use` locally matches CI.

**Recommended after the first push:** Settings → Branches → add a rule for `main`
requiring the `Lint, format & types`, `Build & bundle budgets` and
`Lighthouse (hub)` checks, so nothing merges that would fail the deploy.

## Deploying (GitHub Pages)

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. Push to `main`. `deploy.yml` runs the full CI above, then deploys with
   `actions/deploy-pages`. Deploys are queued, never cancelled mid-way.

**Base path.** The workflow takes `base_path` from `actions/configure-pages`, which
already knows whether this is a project site (`/<repo>/`), a user site
(`<user>.github.io` → `/`), or a custom domain (`/`). Nothing to edit. To hard-code
it instead, set `DEFAULT_BASE` in `vite.config.ts` or `BASE_PATH` in the workflow.

**Why hash URLs** (`/Waffle.fun/#/planet`): Pages can't rewrite unknown paths to
`index.html`, and everything after `#` never reaches the server, so deep links and
refreshes always work.

---

## Bandwidth & performance rules

1. **Push work to the client.** Generate content procedurally (shaders, noise,
   seeds) instead of downloading it. Thumbnails are CSS gradients; the planet,
   stars and clouds are math.
2. **Network carries code and compact data only.** If data is unavoidable, prefer
   binary/quantized formats over JSON. If real 3D assets are unavoidable, use glTF +
   Meshopt and KTX2 textures.
3. **Pay only for what you open.** Every project is its own lazy chunk. 2D projects
   must never import `three`, `@react-three/*` or `shared/three/*` (ESLint blocks
   these imports in hub code, and `npm run size` fails the build if a 2D project
   reaches the 3D vendor chunk).
4. **Repeat visits are almost free.** All assets are content-hashed. The service
   worker precaches the hub shell, and caches each project chunk _cache-first_ the
   first time it's opened. That works around Pages' fixed `max-age=600` headers.
   New deploys activate on the next navigation.

### Budgets (enforced in CI by `npm run size`)

| Chunk                          | Budget               | Measured (gzip)                        |
| ------------------------------ | -------------------- | -------------------------------------- |
| Hub first load (JS)            | < 80 KB              | **70.3 KB**                            |
| Hub CSS                        | —                    | 1.6 KB                                 |
| Shared 3D vendor (three + R3F) | "small as practical" | **238.5 KB** (910 KB raw)              |
| `planet` (excl. shared vendor) | < 50 KB              | **9.6 KB** (incl. shared `worlds`)     |
| `gravity-courier`              | < 50 KB              | **20.4 KB** (incl. shared `worlds`)    |
| `waffle-tower`                 | < 50 KB              | **5.0 KB**, loads three-vendor: **no** |

Project sizes include every chunk the project needs beyond the hub and the 3D vendor,
including shared ones, so the real marginal cost of the second 3D project is lower:
`worlds` (6.2 KB) is already cached.

Measured with Vite 8.3 / three r187. Re-run `npm run size` for current numbers, and
`npm run analyze` for a treemap.

How chunks are split (`vite.config.ts → codeSplitting.groups`):

- `react-vendor`: react + react-dom + scheduler (hub).
- `three-vendor`: three, R3F, the drei pieces actually used, three-stdlib. Downloaded
  once, shared by every 3D project, prefetched when you hover a 3D card.
- `worlds`: the shared world generator + 3D helpers (`src/shared/worlds`,
  `src/shared/three`), used by Planet Forge and Gravity Courier.
- `p-<slug>`: one chunk per project.

---

## Shared world generator

Planets and moons are defined once, in shared code that no single project owns:

| File                                 | What it decides                                        |
| ------------------------------------ | ------------------------------------------------------ |
| `shared/worlds/world.ts`             | biome, palette, terrain params, name; moons per planet |
| `shared/worlds/system.ts`            | star systems built from those planets + moons (games)  |
| `shared/three/worlds/shaders.ts`     | terrain / cloud / atmosphere GLSL                      |
| `shared/three/worlds/PlanetBody.tsx` | the R3F component that renders one world               |

Planet Forge is a thin UI over these files, and Gravity Courier renders its systems
with the same `PlanetBody`. **Improve the generator or shaders here and both projects
change.** A system planet with seed N is identical to `#/planet?seed=N`, and the game's
route links open each planet in Planet Forge.

Heads-up: changing `world.ts` or `system.ts` changes what each seed produces, so it
also changes Gravity Courier's systems and invalidates old ghosts/leaderboards for
those seeds. Shader-only changes (looks) are always safe.

## Gravity Courier: how it stays deterministic

Ghost replays and (later) server-verified leaderboards need the simulation to give
**bit-identical** results in every browser and on a server:

- Fixed 60 Hz timestep with 2 substeps; rendering interpolates between steps.
- Planets and moons move on analytic rails (no drift, any time is exact).
- Only IEEE-exact math: `+ - * /`, `Math.sqrt`, plus our own `dsin`/`dcos`
  (`shared/worlds/dmath.ts`). `Math.sin`, `pow`, `atan2`… can differ between engines
  in the last bits. ESLint bans them (and `Date`, `Math.random`) in `shared/worlds/`
  and any `projects/*/sim/` folder.
- Fuel and scores are integers.

A run is stored as its seed plus one input byte per tick, run-length encoded and
base64url'd: about **20–2000 bytes** per run. That's what the ghost replays, and
`sim/verify.ts` re-simulates it headlessly. When the backend arrives, the server runs
`verifyRun()` on the submitted replay and keeps the score **it** computed. That's the
anti-cheat plan from `services/README.md`. Tests (`npm test`) check that a recorded
run re-simulates to exactly the same score.

---

## Backend (planned, not implemented)

Projects talk to `src/services` only. Today `VITE_BACKEND=local` stores scores in
localStorage, so everything works offline. Adding Supabase, Firebase or
Cloudflare D1 later is a change inside `services/` (a new provider file and one
`case` in `services/index.ts`, loaded via dynamic import so its SDK stays out of the
hub bundle). See [`src/services/README.md`](src/services/README.md) for the
step-by-step and the anti-cheat plan (bounds checks, rate limiting, server-side
plausibility checks; the client already sends `meta` such as drop count and game
duration for this).

---

## Dependencies

Runtime: `react`, `react-dom`, `three`, `@react-three/fiber`, `@react-three/drei`
(only `OrbitControls`, which tree-shakes to under 1 KB), `zustand`.

Dev, beyond the brief's stack: `@types/node` (typing `vite.config.ts`),
`eslint-config-prettier` (stops ESLint and Prettier fighting), `globals`,
`eslint-plugin-react-hooks` / `-react-refresh` (standard Vite React lint set).

**Deliberate deviation: no React Router.** React Router v8 added ~18 KB gz and
pushed the hub to 82 KB, over budget. This site only needs flat `#/<slug>?query`
routes, so `src/shared/router.tsx` (~1 KB) provides `Link`, `useLocation`,
`useSearchParams` and `navigate` with React Router's names. If nested routes or
loaders are ever needed, `npm i react-router` and switch the imports.
