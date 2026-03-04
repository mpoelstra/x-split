# X-Split (Angular)

X-Split is a lightweight Splitwise replacement for shared Xbox game purchases.

## Modes

- `stub` (default): local mock backend + auth bypass
- `supabase`: real Supabase backend + Google auth

## Run locally (stub)

```bash
npm install
npm start
```

App uses `StubInterceptor` and seeded in-memory data, so no external setup is required.

## Run against Supabase

1. Copy the example file:

```bash
cp src/environments/environment.supabase.local.example.ts src/environments/environment.supabase.local.ts
```

2. Update values in `src/environments/environment.supabase.local.ts`
3. Start app:

```bash
npm run start:supabase
```

`environment.supabase.local.ts` is gitignored and required by the `supabase` run/build scripts.

## Build

```bash
npm run build
npm run build:stub
npm run build:supabase
```

## Unit tests only

```bash
npm test
```

## CSV migration

Dry-run:

```bash
npm run migrate:csv
```

Live import to Supabase:

```bash
MIGRATE_LIVE=true \
SUPABASE_URL=https://<project>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
MARK_PROFILE_ID=<mark-auth-user-id> \
RICHARD_PROFILE_ID=<richard-auth-user-id> \
npm run migrate:csv
```

## Supabase schema

SQL schema and RLS policies are in `supabase/schema.sql`.
