# Local test stack

For testing features against real data without going near production. Postgres
runs in Docker; the API, the web app and a small proxy run natively.

Production is never touched: the database is a separate container on its own
port, the seed script refuses any other database, and the proxy only forwards to
127.0.0.1.

## Up

```powershell
# 1. Database (first run pulls postgres:16-alpine)
docker compose -f docker-compose.local.yml up -d

# 2. Schema
cd apps/api
$env:DATABASE_URL = "postgresql://weered:weered@127.0.0.1:15432/weered_local"
npx prisma db push --skip-generate

# 3. API — its own terminal
$env:DATABASE_URL = "postgresql://weered:weered@127.0.0.1:15432/weered_local"
$env:NODE_ENV = "development"; $env:JWT_SECRET = "local-only-secret"
$env:APP_URL = "http://bar.localhost:8080"
npx tsx src/index.ts

# 4. Web — its own terminal, from apps/web
$env:NEXT_PUBLIC_API_BASE = "https://api.weered.ca"   # rewritten to /api by the fetch patch; see proxy.mjs
npx next dev -p 3000

# 5. Proxy — its own terminal, from the repo root
node scripts/local/proxy.mjs
```

Then open **http://bar.localhost:8080**, register an account, and seed:

```powershell
cd apps/api
$env:DATABASE_URL = "postgresql://weered:weered@127.0.0.1:15432/weered_local"
node scripts/local-seed-bar.mjs <your-username>
```

The seed prints the lobby and room links. Linked names are pulled from BAR's
live data at that moment, so re-run it to refresh who is in a game.

## Gotchas

- **Browse bar.localhost:8080, never localhost:3000.** Straight to Next, the
  session cookie is never sent to the API and every signed-in feature fails.
- **Server-rendered code still reads `NEXT_PUBLIC_API_BASE` literally.** Page
  metadata rendered on the server fetches the real api.weered.ca: read-only,
  unauthenticated, but it means titles can show production values.
- **The API starts its background workers.** Without API keys they fail quietly;
  expect noise in its log, not errors in the app.

- **Closing the API's terminal can leave node running.** On Windows the tsx
  child survives its parent, keeps ports 4000 and 4001, and the next start dies
  with `EADDRINUSE` while the OLD code keeps answering requests. Before
  restarting, check and kill whatever holds the port:

  ```powershell
  Get-NetTCPConnection -LocalPort 4000,4001 -State Listen | Select-Object LocalPort,OwningProcess
  Stop-Process -Id <OwningProcess> -Force
  ```

- **Port 15432, not 55432.** Hyper-V and WSL reserve 55389–55488 on this
  machine; `netsh interface ipv4 show excludedportrange protocol=tcp` lists the
  current reservations.

## Down

```powershell
docker compose -f docker-compose.local.yml down        # keeps the data
docker compose -f docker-compose.local.yml down -v     # wipes it
```
