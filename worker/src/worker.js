/**
 * This outer worker workspace is no longer the entry point.
 *
 * The canonical worker lives at server/src/worker/worker.js.
 * Run it via the root npm scripts:
 *
 *   npm run dev:worker     → nodemon server/src/worker/worker.js
 *   npm run start:worker   → node   server/src/worker/worker.js
 *
 * Or directly via the server workspace:
 *
 *   npm run worker:dev --workspace=server
 *   npm run worker     --workspace=server
 */

throw new Error(
  'worker/src/worker.js is a stub. Use `npm run dev:worker` from the repo root, ' +
  'which runs server/src/worker/worker.js.'
);
