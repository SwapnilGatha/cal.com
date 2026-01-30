# Cal.com Sync API - Production Setup

## Overview

The Sync API service has been added back to your production deployment with a **proper production configuration** that doesn't require local source code.

---

## ✅ What Was Added

### 1. [Dockerfile.sync](file:///home/krishnavamshi/cal.com/Dockerfile.sync)

Production-optimized multi-stage Dockerfile for the Sync API service.

**Key Features:**

- 3-stage build: deps → builder → runner
- `node:20-alpine` base image
- Includes Prisma client generation
- Non-root user (`syncapi`)
- No volume mounts required
- Health check on port 3002

**Expected Size:** ~800MB-1GB

### 2. Updated Docker Compose Files

Added `calcom-sync-api` service to both:

- [docker-compose.yml](file:///home/krishnavamshi/cal.com/docker-compose.yml)
- [docker-compose.prod.yml](file:///home/krishnavamshi/cal.com/docker-compose.prod.yml)

**Service Configuration:**

```yaml
calcom-sync-api:
  container_name: calcom-sync-api
  image: krishnavamshi933/calcom-sync:latest
  ports:
    - 3002:3002
  environment:
    - DATABASE_URL=...
    - SYNC_API_SECRET=...
    - SHADOW_USER_PASSWORD=...
    - DEFAULT_TIMEZONE=UTC
    # ... other sync-related env vars
```

### 3. Updated [build-images.sh](file:///home/krishnavamshi/cal.com/build-images.sh)

Now builds and pushes 3 images:

- `krishnavamshi933/calcom-web:latest`
- `krishnavamshi933/calcom-api:latest`
- `krishnavamshi933/calcom-sync:latest` ← **NEW**

---

## 🔄 Differences from Original Configuration

| Aspect               | Original (Developer's)  | New (Production)                 |
| -------------------- | ----------------------- | -------------------------------- |
| **Image**            | Official Cal.com v6.0.7 | Custom built image               |
| **Source Code**      | Volume mount required   | Built into image                 |
| **Deployment**       | Needs local files       | Only needs docker-compose + .env |
| **Command**          | `npx ts-node ...`       | Same, but files are in image     |
| **Production Ready** | ❌ No                   | ✅ Yes                           |

---

## 🚀 Build & Deploy

### Step 1: Build All Images

```bash
cd /home/krishnavamshi/cal.com
./build-images.sh
```

This will now build **3 images**:

1. Web app (~1.2GB)
2. API (~600MB)
3. Sync API (~800MB-1GB)

### Step 2: Deploy to Server

```bash
# Stop existing containers
docker compose down

# Pull new images (including sync API)
docker compose -f docker-compose.prod.yml pull

# Start all services
docker compose -f docker-compose.prod.yml up -d
```

### Step 3: Verify Sync API

```bash
# Check all containers are running
docker compose ps

# Should see 5 containers:
# - database
# - redis
# - calcom (port 3000)
# - calcom-api (port 8080)
# - calcom-sync-api (port 3002) ← NEW

# Check sync API logs
docker compose logs calcom-sync-api

# Test sync API health
curl http://localhost:3002/health
```

---

## 🔐 Required Environment Variables

Make sure these are in your `.env` file:

```bash
# Sync API Configuration
SYNC_API_SECRET=your-sync-api-secret-here
SHADOW_USER_PASSWORD=your-shadow-user-password

# Optional (with defaults)
DEFAULT_TIMEZONE=UTC
DEFAULT_EVENT_TYPE_SLUG=30min
DEFAULT_EVENT_TYPE_TITLE=30 Min Meeting
DEFAULT_WORKING_HOURS_START=9
DEFAULT_WORKING_HOURS_END=17
```

---

## 📊 Service Architecture

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  Cal.com Production Stack                      │
│                                                 │
│  ┌──────────────┐  ┌──────────────┐           │
│  │  PostgreSQL  │  │    Redis     │           │
│  │  (port 5432) │  │  (port 6379) │           │
│  └──────────────┘  └──────────────┘           │
│         ▲                  ▲                    │
│         │                  │                    │
│  ┌──────┴──────────────────┴──────┐           │
│  │                                 │           │
│  │  ┌─────────────────────────┐  │           │
│  │  │  Cal.com Web (3000)     │  │           │
│  │  └─────────────────────────┘  │           │
│  │                                 │           │
│  │  ┌─────────────────────────┐  │           │
│  │  │  Cal.com API (8080)     │  │           │
│  │  └─────────────────────────┘  │           │
│  │                                 │           │
│  │  ┌─────────────────────────┐  │  ← NEW    │
│  │  │  Sync API (3002)        │  │           │
│  │  └─────────────────────────┘  │           │
│  │                                 │           │
│  └─────────────────────────────────┘           │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 🎯 What the Sync API Does

The Sync API service provides:

1. **Calendar Synchronization**
   - Real-time sync with Google Calendar, Outlook, etc.
   - Webhook handling for calendar events
   - Background sync jobs

2. **Event Management**
   - Creates/updates/deletes events across calendars
   - Handles conflicts and availability checks
   - Manages recurring events

3. **Integration Support**
   - Processes calendar provider webhooks
   - Maintains sync state
   - Handles authentication tokens

---

## ✅ Verification Checklist

After deployment:

- [ ] Sync API container starts successfully
- [ ] Container reaches "healthy" status
- [ ] Port 3002 is accessible
- [ ] No errors in logs: `docker compose logs calcom-sync-api`
- [ ] Health endpoint responds: `curl http://localhost:3002/health`
- [ ] Calendar integrations work (if configured)

---

## 🆘 Troubleshooting

**Container fails to start:**

```bash
# Check logs
docker compose logs calcom-sync-api

# Common issues:
# 1. Missing SYNC_API_SECRET in .env
# 2. Database not ready (check depends_on)
# 3. Port 3002 already in use
```

**Prisma errors:**

```bash
# Sync API needs database access
# Ensure DATABASE_URL is correct
# Check database container is healthy
docker compose ps database
```

**Build fails:**

```bash
# Ensure you have the packages/prisma directory
# The Dockerfile copies it during build
ls -la packages/prisma/
```

---

## 📝 Summary

✅ **Production-ready** sync API configuration  
✅ **No volume mounts** - everything built into image  
✅ **Works on any server** - only needs docker-compose + .env  
✅ **Optimized** - Alpine base, multi-stage build  
✅ **Secure** - Non-root user, health checks

The sync API is now properly integrated into your production stack!
