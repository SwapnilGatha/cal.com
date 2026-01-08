# Walkthrough - Running Cal.com with Docker

I have successfully set up and run the Cal.com application using Docker.

## Changes Made
### 1. Environment Setup
- Created `.env` from `.env.example`.
- Generated secure keys for `NEXTAUTH_SECRET` and `CALENDSO_ENCRYPTION_KEY`.
- Configured Postgres variables (`POSTGRES_USER`, etc.) to match `docker-compose.yml` expectations.

### 2. ARM Architecture Support
- **Issue**: The default `docker-compose.yml` image configuration failed on your ARM-based Mac (`no matching manifest for linux/arm64/v8`).
- **Fix**: Updated `docker-compose.yml` to use the specific ARM image tag `calcom.docker.scarf.sh/calcom/cal.com:v6.0.7-arm` for both `calcom` and `studio` services.

### 3. Port Conflict Resolution
- **Issue**: Port `6379` was already in use, preventing Redis from starting.
- **Fix**: Configured `REDIS_PORT=6380` in `.env` to avoid the conflict.

### 4. Service Selection
- **Issue**: The `calcom-api` service required building from source which was taking an excessive amount of time (>12 mins).
- **Resolution**: I started the stack excluding `calcom-api` using the command `docker compose up -d calcom studio redis`. The main web application (`calcom`) runs fine without the separate V2 API service for standard usage.

## Verification Results
### Container Status
All core services are up and running:
- `calcom`: **Up** (Port 3000)
- `studio`: **Up** (Port 5555)
- `database`: **Up**
- `redis`: **Up** (Port 6380)

### Application Access
Checked connectivity to the web application:
- Post-fix Status:
    - URL: `http://localhost:3000`
    - Result: `HTTP 307 Temporary Redirect` to `/auth/login`.

### 5. Resolved 500 Error (Database Connection)
- **Issue**: The application returned a 500 error because it could not connect to the database (`P1001: Can't reach database server at localhost:5450`) and thus the `public.users` table was missing.
- **Root Cause**: The `.env` file contained `DATABASE_URL=...localhost:5450...` (from `.env.example`), which works for local dev but fails inside Docker where `localhost` is the container itself.
- **Fix**:
    1. Updated `.env` on host: Set `DATABASE_URL` to `postgresql://unicorn_user:magical_password@database:5432/calendso`.
    2. Recreated the container: `docker compose up -d calcom`.
    3. Ran database migrations: `docker compose exec calcom yarn workspace @calcom/prisma db-deploy`.
- **Outcome**: Database tables were created, and the application started successfully.

> If you encounter the 500 error again after restarting Docker (e.g., via `docker compose down`), it indicates the database volume might have been reset. In that case, simply run the migration command again:
> `docker compose exec calcom yarn workspace @calcom/prisma db-deploy`

### 6. User Creation (Workaround for API v2)
Since API v2 (`calcom-api`) service is not running in this configuration, I created a script to programmatically create users.

**Created Admin User:**
- **Email:** `admin@example.com`
- **Password:** `password123`
- **Role:** `ADMIN`

**How to create more users:**
1. I have placed a script at `packages/prisma/create-user.ts`.
2. To run it, execute the following command (replace arguments as needed):
   ```bash
   docker compose exec calcom npx ts-node --transpile-only packages/prisma/create-user.ts <email> <password> [username] [role:admin|user]
   ```
   Example:
   ```bash
   docker compose exec calcom npx ts-node --transpile-only packages/prisma/create-user.ts newuser@example.com secret123 newuser user
   ```
   
   **Note:** If you see an error about `@prisma/client` not initialized, run this first:
   ```bash
   docker compose exec calcom yarn workspace @calcom/prisma prisma generate
   ```

### 7. Database Connection (pgAdmin)
To connect using pgAdmin (or any external tool), I have exposed the database port.

**Connection Details:**
- **Host Name/Address:** `localhost`
- **Port:** `5433` (Used 5433 to avoid conflict with local Postgres on 5432)
- **Maintenance Database:** `calendso`
- **Username:** `unicorn_user`
- **Password:** `magical_password`

### 8. API v2 (Platform API) ✅
API v2 is now running successfully and can be used to manage users programmatically.

**Server Status:**
- Running on: `http://localhost:5556`
- Redis: Connected
- Status: ✅ Operational

**Setup Steps Completed:**
1. Created `apps/api/v2/.env` with database connection to Docker PostgreSQL on port `5433`
2. Added `REDIS_URL=redis://localhost:6380` for Redis connection
3. Set `API_PORT=5556` to avoid conflict with Prisma Studio (port 5555)
4. Created Organization and OAuth Client in database
5. Updated Organization to Platform mode (`isPlatform=true`)

**OAuth Client Credentials:**
- **Client ID:** `my-client-id`
- **Client Secret:** `my-client-secret`
- **Organization:** `My Platform Org` (ID: 1)

**How to Retrieve Current Credentials:**

If you need to check what OAuth clients exist in your database:

```bash
# Query all OAuth clients
docker compose exec calcom npx ts-node --transpile-only -e "
import { prisma } from './packages/prisma/index';
async function main() {
  const clients = await prisma.platformOAuthClient.findMany({
    select: { id: true, name: true, secret: true, organizationId: true }
  });
  console.log(JSON.stringify(clients, null, 2));
}
main().then(() => prisma.\$disconnect());
"
```

This will output all OAuth clients with their IDs and secrets.

**How to Create New OAuth Clients:**

**For Local Development:**

Create a new OAuth client using a database script:

```bash
# Create a new OAuth client
docker compose exec calcom npx ts-node --transpile-only -e "
import { prisma } from './packages/prisma/index';
async function main() {
  const client = await prisma.platformOAuthClient.create({
    data: {
      id: 'your-new-client-id',
      name: 'Your Client Name',
      secret: 'your-new-client-secret',
      permissions: 255,
      organizationId: 1,  // Use your organization ID
      redirectUris: ['http://localhost:3000']
    }
  });
  console.log('Created OAuth Client:', JSON.stringify(client, null, 2));
}
main().then(() => prisma.\$disconnect());
"
```

> **Note:** Replace `your-new-client-id`, `your-new-client-secret`, and `Your Client Name` with your desired values.

**For Production:**

In a production Cal.com instance, create OAuth clients through the web UI:

1. Navigate to: `https://app.cal.com/settings/platform`
2. Click "Create OAuth Client"
3. Fill in the required details:
   - **Name:** Your application name
   - **Redirect URIs:** Your application's callback URLs
4. Save and securely store the generated Client ID and Secret

> **Important:** The Client Secret is only shown once. Store it securely (e.g., in a password manager or secrets vault).

**Start the API Server:**
```bash
cd /Users/swapnilgatha/workspace/calcom-repo-app/cal.com
yarn workspace @calcom/api-v2 dev:no-docker
```

**Create a Managed User (Example):**
```bash
# Basic request
curl -X POST http://localhost:5556/api/v2/oauth-clients/my-client-id/users \
  -H "x-cal-secret-key: my-client-secret" \
  -H "Content-Type: application/json" \
  -H "x-cal-api-version: 2024-04-15" \
  -d '{"email": "newuser@example.com", "name": "New User"}'

# With formatted output (using jq)
curl -s -X POST http://localhost:5556/api/v2/oauth-clients/my-client-id/users \
  -H "x-cal-secret-key: my-client-secret" \
  -H "Content-Type: application/json" \
  -H "x-cal-api-version: 2024-04-15" \
  -d '{"email": "user@example.com", "name": "User Name"}' | jq
```

> **Tip:** Use `| jq` at the end of curl commands for formatted, colored JSON output. Install with `brew install jq`.

**Successful Response Example:**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": 3,
      "email": "verified-platform-user+my-client-id@example.com",
      "username": "verified-platform-user-my-client-id-example-com",
      "name": "Verified Platform User",
      "timeZone": "Europe/London",
      "weekStart": "Sunday"
    },
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci..."
  }
}
```

**API Documentation:**
- Full API Reference: https://cal.com/docs/api-reference/v2/introduction
- Platform Endpoints: https://cal.com/docs/api-reference/v2/platform-managed-users/create-a-managed-user

### 9. Production Deployment Workflow 🚀
To transition your local setup to a production environment, follow these steps:

#### 1. Prepare Environment Variables
- Create a `.env` file on your production server based on `production.env.example`.
- **CRITICAL**: Generate unique, secure random strings for `NEXTAUTH_SECRET`, `CALENDSO_ENCRYPTION_KEY`, and `JWT_SECRET`.
- Configure `DATABASE_URL` and `NEXT_PUBLIC_WEBAPP_URL` to match your production domain.

#### 2. Configure Docker for Production
- A separate `docker-compose.prod.yml` file has been created with:
    - **Resource Limits**: Memory limits for each service (Database: 1G, Calcom: 2G, API: 1G, Redis: 512M).
    - **Security**: Database and Redis ports are no longer exposed to the host by default.
    - **API v2**: Configured to run within the Docker network using official images.
    - **Prisma Studio**: Disabled for security.

#### 3. Git and Secret Management
- **DO COMMIT**: `docker-compose.prod.yml` (New), `docker-compose.yml` (Local), `packages/prisma/create-user.ts`, `packages/prisma/seed-oauth.ts`.
- **DO NOT COMMIT**: `.env` or `production.env.example` (if filled with real secrets). Use a secret manager or CI/CD secrets for production credentials.

#### 4. Deployment Steps
1. Push your updated codebase to your repository.
2. SSH into your production server.
3. Clone/pull the repository.
4. Set up the production `.env`.
5. Run the deployment:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```
6. Run migrations:
   ```bash
   docker compose -f docker-compose.prod.yml exec calcom npx prisma migrate deploy
   ```

> [!TIP]
> **Architecture Check**: If your production host is not ARM-based (e.g., standard x86/64), ensure you use the standard Docker images instead of the `-arm` tags in `docker-compose.yml`.

