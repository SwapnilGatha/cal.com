# Backend Integration Guide: Calling the Sync Script

This guide provides code snippets for calling the `shadow-user-sync.ts` script from your own Node.js backend.

## Approach 1: Using Docker Exec (Recommended for Co-located Servers)

If your backend and the Cal.com Docker container run on the same server, you can use `child_process.exec` to trigger the script inside the running container.

### `utils/calcom-sync.js`

```javascript
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Syncs a user to the Cal.com instance (Shadow User).
 * @param {string} email - User's email
 * @param {string} name - User's full name
 * @param {string} username - Desired username (slug)
 */
async function syncToCalCom(email, name, username) {
  try {
    // Command to run inside the 'calcom' container
    // Note: We use the container name 'calcom' or 'calcom-calcom-1' depending on your setup
    const containerName = 'calcom'; 
    const command = `docker exec ${containerName} npx ts-node --transpile-only packages/prisma/shadow-user-sync.ts sync "${email}" "${name}" "${username}"`;

    const { stdout, stderr } = await execPromise(command);

    console.log('✅ Cal.com Sync Success:', stdout);
    if (stderr) console.warn('⚠️ Cal.com Sync Warning:', stderr);
    
    return true;
  } catch (error) {
    console.error('❌ Cal.com Sync Failed:', error.message);
    throw error;
  }
}

/**
 * Updates a user's availability.
 * @param {string} username - Cal.com username
 * @param {number[]} days - Array of days (0-6, where 1=Mon)
 * @param {string} start - Start time (HH:mm:ss)
 * @param {string} end - End time (HH:mm:ss)
 */
async function updateAvailability(username, days, start, end) {
  try {
    const daysStr = days.join(',');
    const containerName = 'calcom';
    const command = `docker exec ${containerName} npx ts-node --transpile-only packages/prisma/shadow-user-sync.ts update-availability "${username}" "${daysStr}" "${start}" "${end}"`;

    const { stdout } = await execPromise(command);
    console.log('✅ Availability Updated:', stdout);
    return true;
  } catch (error) {
    console.error('❌ Availability Update Failed:', error.message);
    throw error;
  }
}

// Example Usage
// syncToCalCom('alice@example.com', 'Alice Wonderland', 'alice-w');
// updateAvailability('alice-w', [1, 3, 5], '09:00:00', '13:00:00');

module.exports = { syncToCalCom, updateAvailability };
```

---

## Approach 2: Direct Database Write (For Separate Servers)

If your backend is on a different server than Cal.com, running `docker exec` remotely is complex. Instead, you should connect directly to the Cal.com database.

1.  **Install Prisma**: `npm install prisma @prisma/client`
2.  **Copy Schema**: Copy `packages/prisma/schema.prisma` from Cal.com to your backend.
3.  **Generate Client**: `npx prisma generate`

Then, you can simply reuse the logic from `shadow-user-sync.ts` directly in your own code:

```javascript
/* Inside your backend code */
const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcryptjs');

// Connect to Cal.com Database (Ensure port 5432/5433 is exposed and accessible)
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.CALCOM_DATABASE_URL, // e.g. postgres://user:pass@calcom-ip:5433/calendso
    },
  },
});

async function createShadowUser(email, name, username) {
    // ... Copy the body of 'createShadowUser' function from shadow-user-sync.ts ...
    // ... Replace 'export' with standard function logic ...
}
```

---

## Approach 3: Using the Bridge API (Recommended for Production / Remote Backends)

If your backend is on a separate server (like a remote AWS instance), you can use the **Bridge API** we implemented. This avoids exposing your database port publicly.

### Prerequisites
1. Ensure the `calcom-sync-api` container is running (on port 3002).
2. Ensure your AWS Security Group allows inbound traffic on port `3002` from your backend's IP.

### Example: Calling the API via Node.js

```javascript
const axios = require('axios');

async function syncToCalCom(email, name, username) {
  try {
    const response = await axios.post('http://<CALCOM_SERVER_IP>:3002/sync', {
      email,
      name,
      username
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.SYNC_API_SECRET}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Bridge API Sync Success:', response.data);
    return response.data.user;
  } catch (error) {
    console.error('❌ Bridge API Sync Failed:', error.response?.data || error.message);
    throw error;
  }
}
```

---

## Production Verification

To verify that everything is working once deployed:

### 1. Check Connectivity
From your backend server, try to reach the Bridge API:
```bash
curl -I http://<CALCOM_SERVER_IP>:3002/sync
```
You should get a `405 Method Not Allowed` if it's reachable (since it's a GET request), or a `401 Unauthorized` if you send a POST without a token.

### 2. Test User Creation
Run a test `curl` command with your secret:
```bash
curl -X POST http://<CALCOM_SERVER_IP>:3002/sync \
-H "Content-Type: application/json" \
-H "Authorization: Bearer YOUR_SECRET_KEY" \
-d '{
  "email": "prod-test@example.com",
  "name": "Production Test",
  "username": "prod-verify"
}'
```

### 3. Security Check
Ensure that the database port (5433) is **not** accessible from the public internet, only from your backend's IP if you use Approach 2. Approach 3 (Bridge API) only requires port 3002.

## 4. Database Schema Recommendations

When you successfully create a user in Cal.com, **you should store the following fields in your own application's database** to enable the booking flow:

| Field | Type | Purpose |
| :--- | :--- | :--- |
| `calcom_username` | String | **Critical**. Used to generate booking links (e.g., `https://cal.yourdomain.com/${calcom_username}/30min`). |
| `calcom_user_id` | Integer | **Recommended**. Useful for reliable updates or direct database queries if you change the username later. |
| `calcom_booking_url` | String | *Optional*. You can construct this dynamically, but storing the full base URL is convenient. |

### Example User Record
```json
{
  "id": "user_123",
  "email": "alice@example.com",
  "name": "Alice",
  "calcom_username": "alice-w",
  "calcom_user_id": 42
}
```

### Generating Booking Links
In your frontend, you can now dynamically create the booking URL:
```javascript
const bookingUrl = `https://cal.yourdomain.com/${user.calcom_username}/30min`;
```
