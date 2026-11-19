# Sherbo's Tower

Educational climbing game for Sherbeni Academy students (React + Phaser 3 + Vite).
Climb the tower, answer a question at each of the 5 gates, reach the summit.

## Run

```bash
npm install
npm run dev      # local development
npm run build    # production build (dist/)
```

Unit tests (Node 22+):

```bash
node --experimental-strip-types src/game/scoring.test.ts
node --experimental-strip-types src/data/questionBank.test.ts
node --experimental-strip-types src/data/remoteGame.test.ts
node --experimental-strip-types src/utils/platformBridge.test.ts
```

## Questions

Edit `public/questions.json` (loaded at runtime) and keep `src/data/questions.json`
(bundled fallback) identical. Each gate needs at least 3 questions; answer options are
shuffled automatically every time a question is shown.

## Gameplay

| Section | New platform type |
| --- | --- |
| 1 | plain steps |
| 2 | moving platforms |
| 3 | crumbling platforms |
| 4 | ice + springs |
| 5–6 | all of them, faster and narrower |

Layout and difficulty per section live in `SECTION_DESIGNS` (`src/game/PlatformManager.ts`).
Coins give +10 XP each. The stopwatch counts climbing time only (it pauses on questions).

## Security note

This is a client-only game: the answers ship in `questions.json` and the score is computed
in the browser, so the completion message sent to the host page can be forged. Do not use
it for grades or prizes without server-side validation.

`vercel.json` only allows embedding on `sherbeniacademy.com` — add other domains to
`frame-ancestors` if the game is embedded elsewhere.

## Production deployment

Production is served by Nginx at `https://sherbogame.shiftup-solutions.com`.
Until that hostname is available, the same release is reachable directly at
`http://187.77.71.97:3201`.
To publish changes manually from the VPS, run `./deploy-manual.sh`. The script
installs locked dependencies, runs the tests and production build, creates a
versioned release under `/var/www/sherbogame/releases`, and atomically updates
the `/var/www/sherbogame/current` symlink. The VPS keeps its production
`VITE_API_URL` in the untracked `.env` file.
The current direct-IP deployment can use an HTTP API; switch it to HTTPS before
enabling the final HTTPS game domain to avoid browser mixed-content blocking.

The GitHub workflow is manual-only and can still be started with
`workflow_dispatch` if remote deployment is needed later.

The Nginx source configuration is kept in
`deploy/nginx/sherbogame.shiftup-solutions.com.conf`. Validate it with
`nginx -t` before reloading Nginx. The backend must set `SHERBO_GAME_URL` to the
public HTTPS game origin so tower links use this deployment.
