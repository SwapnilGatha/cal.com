# Cal.com Custom Setup & Deployment Guide

This guide covers the custom configurations made to this repository, including local Docker setup, API v2 enablement, and production deployment workflows.

## 1. Local Development Setup (Docker)

### Core Services
The repository is configured to run the following core services via Docker:
- **calcom**: The main web application (accessible at `http://localhost:3000`).
- **database**: PostgreSQL (accessible internally by containers).
- **redis**: Caching service.
- **studio**: Prisma Studio for database management (accessible at `http://localhost:5555`).

### Running the Stack
To start the local environment:
```bash
docker compose up -d calcom studio redis
```

### ARM Architecture Support (Mac M1/M2/M3)
The `docker-compose.yml` has been updated to use specific ARM-compatible image tags:
- `calcom.docker.scarf.sh/calcom/cal.com:v6.0.7-arm`

---

## 2. Database Management

### Connectivity (pgAdmin / External Tools)
The database port is exposed locally to allow external connections:
- **Host**: `localhost`
- **Port**: `5433` (Avoids conflict with local Postgres on 5432)
- **User**: `unicorn_user`
- **Password**: `magical_password`
- **Database**: `calendso`

### Running Migrations
If the database schema is not initialized or you encounter a 500 error:
```bash
docker compose exec calcom yarn workspace @calcom/prisma db-deploy
```

### Manual User Creation
A utility script is available at `packages/prisma/create-user.ts`:
```bash
docker compose exec calcom npx ts-node --transpile-only packages/prisma/create-user.ts <email> <password> [username] [role:admin|user]
```

---

## 3. Cal.com API v2 (Platform API)

### Local Configuration
API v2 is configured to run locally (not inside Docker) for faster development.
1. **Env File**: `apps/api/v2/.env`
2. **Redis**: Using `localhost:6380` (remapped in `docker-compose.yml`).
3. **Database**: Connecting via `localhost:5433`.

### Starting the API Server
```bash
yarn workspace @calcom/api-v2 dev:no-docker
```
The server will be available at `http://localhost:5556`.

### Initial OAuth Client Seeding
A script at `packages/prisma/seed-oauth.ts` was used to create the initial Platform Organization and OAuth credentials:
- **Client ID**: `my-client-id`
- **Client Secret**: `my-client-secret`

---

## 4. Production Deployment Workflow

### Separate Configurations
- **Local**: Uses `docker-compose.yml` (Exposed ports, Prisma Studio enabled).
- **Production**: Uses `docker-compose.prod.yml` (Secure networking, resource limits, Prisma Studio disabled).

### Deployment Steps
1. **Prepare `.env`**: Create a server-side `.env` based on `production.env.example`.
2. **Deploy**:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```
3. **Migrate**:
   ```bash
   docker compose -f docker-compose.prod.yml exec calcom npx prisma migrate deploy
   ```

### Git & Secrets Hygiene
- **Commit**: `docker-compose.prod.yml`, `production.env.example`.
- **Ignore**: Never commit real `.env` files. Use a secret manager for production credentials.

---

## 5. Troubleshooting Reference

- **Port Conflicts**: If port 6379 is busy, ensure `.env` has `REDIS_PORT=6380`.
- **Database Connection Issues**: Ensure the application's `DATABASE_URL` uses the container name `database` when running inside Docker, or `localhost` when running scripts from the host.

---

## 6. Shadow User Integration (A ↔ B Booking)

This is the recommended approach for custom React applications requiring free any-to-any booking between members.

### How it Works
Instead of managed users, your backend creates "Standard Users" in Cal.com automatically. Cal.com handles the complexity of availability and conflicts.

### Syncing Users
Use the script at `packages/prisma/shadow-user-sync.ts`:
```bash
# Seed test users
DATABASE_URL="postgresql://unicorn_user:magical_password@localhost:5433/calendso" npx ts-node --transpile-only packages/prisma/shadow-user-sync.ts seed-test

# Sync a specific user from your app
DATABASE_URL="postgresql://unicorn_user:magical_password@localhost:5433/calendso" npx ts-node --transpile-only packages/prisma/shadow-user-sync.ts sync <email> <name> <username>
```

### Verified Booking Links
Once synced, users are bookable via standard URLs:
- `http://localhost:3000/user-b/30min`
- `http://localhost:3000/user-c/30min`
- `http://localhost:3000/user-d/30min`

### Backend Mapping Recommendation
Store the Cal.com `username` in your application's user table to dynamically generate booking links for your frontend embeds.
