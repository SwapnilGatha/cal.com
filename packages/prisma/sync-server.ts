import http from 'node:http';
import process from 'node:process';
import { createShadowUser, updateAvailability } from './shadow-user-sync';

const PORT: string | number = process.env.SYNC_API_PORT || 3002;
const API_SECRET: string = process.env.SYNC_API_SECRET || 'changeme-in-production';

interface SyncRequest {
  email: string;
  name: string;
  username: string;
}

interface AvailabilityRequest {
  username: string;
  days: number[];
  startTime: string;
  endTime: string;
}

interface BookingsRequest {
  username: string;
  type?: 'all' | 'upcoming' | 'past' | 'canceled' | 'pending' | 'recurring';
}

async function handleSync(data: SyncRequest, res: http.ServerResponse): Promise<void> {
  const { email, name, username } = data;
  if (!email || !name || !username) throw new Error('Missing require fields: email, name, username');

  const user = await createShadowUser(email, name, username);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: true, user: { id: user.id, username: user.username } }));
}

async function handleGetBookings(data: BookingsRequest, res: http.ServerResponse): Promise<void> {
  const { username, type = 'upcoming' } = data;
  if (!username) throw new Error('Missing username');

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { prisma } = require('./index');
  const user = await prisma.user.findFirst({ where: { username } });
  if (!user) throw new Error('User not found');

  const now = new Date();
  const where: Record<string, unknown> = { userId: user.id };

  switch (type) {
    case 'upcoming':
      where.startTime = { gte: now };
      where.status = { notIn: ['CANCELLED', 'REJECTED'] };
      break;
    case 'past':
      where.startTime = { lt: now };
      break;
    case 'canceled':
      where.status = 'CANCELLED';
      break;
    case 'pending':
      where.status = { in: ['PENDING', 'AWAITING_HOST'] };
      break;
    case 'recurring':
      where.recurringEventId = { not: null };
      break;
    case 'all':
    default:
      break;
  }

  let orderDirection: 'asc' | 'desc' = 'asc';
  if (type === 'past') {
    orderDirection = 'desc';
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      attendees: true,
      eventType: {
        select: {
          id: true,
          title: true,
          slug: true,
          length: true,
        },
      },
    },
    orderBy: { startTime: orderDirection },
  });

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: true, bookings }));
}

async function handleAvailability(data: AvailabilityRequest, res: http.ServerResponse): Promise<void> {
  const { username, days, startTime, endTime } = data;
  if (!username || !days || !startTime || !endTime) throw new Error('Missing fields');

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { prisma } = require('./index');
  const user = await prisma.user.findFirst({ where: { username } });
  if (!user) throw new Error('User not found');
  
  const schedule = await prisma.schedule.findFirst({ where: { userId: user.id, name: 'Default Schedule' } });
  if (!schedule) throw new Error('Schedule not found');

  await updateAvailability(user.id, schedule.id, days, startTime, endTime);
  
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: true }));
}

const server: http.Server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.headers.authorization !== `Bearer ${API_SECRET}`) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end();
    return;
  }

  let body = '';
  req.on('data', (chunk) => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    try {
      const data = JSON.parse(body);
      if (req.url === '/sync') await handleSync(data, res);
      else if (req.url === '/availability') await handleAvailability(data, res);
      else if (req.url === '/bookings') await handleGetBookings(data, res);
      else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not Found', url: req.url }));
      }
    } catch (error) {
       const err = error as Error;
       console.error('API Error:', err);
       res.writeHead(500, { 'Content-Type': 'application/json' });
       res.end(JSON.stringify({ error: err.message }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Sync Bridge API running on port ${PORT}`);
});
