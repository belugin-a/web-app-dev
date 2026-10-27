import express from 'express';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, '..');
const flightsFile = path.join(projectRoot, 'data', 'flights.json');

const seed = JSON.parse(await readFile(flightsFile, 'utf8'));
const flights = seed.flights.map((flight) => ({ ...flight }));

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(express.static(path.join(projectRoot, 'public')));
app.use('/data', express.static(path.join(projectRoot, 'data')));

const SSE_HISTORY = 5;
const sseClients = new Set();
const announcements = [];

const WEATHER_CONDITIONS = [
  { text: 'ясно', level: 'info' },
  { text: 'малооблачно', level: 'info' },
  { text: 'облачно', level: 'info' },
  { text: 'небольшой дождь', level: 'info' },
  { text: 'сильный дождь', level: 'warning' },
  { text: 'гроза', level: 'warning' },
  { text: 'туман', level: 'warning' },
  { text: 'снегопад', level: 'warning' },
];

function formatAnnouncement(announcement) {
  return `event: announcement\ndata: ${JSON.stringify(announcement)}\n\n`;
}

function pushAnnouncement(text, level = 'info') {
  const announcement = {
    text,
    level,
    at: new Date().toISOString(),
  };

  announcements.push(announcement);

  if (announcements.length > 20) {
    announcements.shift();
  }

  const payload = formatAnnouncement(announcement);

  for (const client of sseClients) {
    client.write(payload);
  }
}

function pushWeather() {
  const cities = [...new Set(flights.map((flight) => flight.city))];
  const city = cities[Math.floor(Math.random() * cities.length)];
  const condition = WEATHER_CONDITIONS[Math.floor(Math.random() * WEATHER_CONDITIONS.length)];
  const temperature = Math.floor(Math.random() * 19) - 3;
  const wind = 1 + Math.floor(Math.random() * 9);
  const sign = temperature > 0 ? '+' : '';

  pushAnnouncement(
    `${city}: ${sign}${temperature} °C, ${condition.text}, ветер ${wind} м/с`,
    condition.level,
  );
}

app.get('/events', (request, response) => {
  response.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  response.write('retry: 3000\n\n');

  for (const announcement of announcements.slice(-SSE_HISTORY)) {
    response.write(formatAnnouncement(announcement));
  }

  sseClients.add(response);
  request.on('close', () => sseClients.delete(response));
});

setInterval(() => {
  for (const client of sseClients) {
    client.write(': keep-alive\n\n');
  }
}, 15000).unref();

const STATUS_FLOW = {
  'По расписанию': 'Регистрация',
  'Регистрация': 'Посадка',
  'Посадка': 'Вылетел',
  'Задержан': 'Посадка',
};

function send(socket, payload) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function broadcast(payload) {
  const message = JSON.stringify(payload);

  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) {
      client.send(message);
    }
  }
}

function snapshotMessage() {
  return {
    type: 'snapshot',
    flights,
    serverTime: new Date().toISOString(),
  };
}

wss.on('connection', (socket) => {
  send(socket, snapshotMessage());

  socket.on('message', (rawMessage) => {
    let message;

    try {
      message = JSON.parse(rawMessage.toString());
    } catch {
      return;
    }

    if (message.type === 'ping') {
      send(socket, { type: 'pong', at: new Date().toISOString() });
    }

    if (message.type === 'refresh') {
      send(socket, snapshotMessage());
    }
  });
});

setInterval(() => {
  const candidates = flights.filter((flight) => STATUS_FLOW[flight.status]);

  if (candidates.length === 0) {
    return;
  }

  const flight = candidates[Math.floor(Math.random() * candidates.length)];
  const nextStatus = Math.random() < 0.15 ? 'Задержан' : STATUS_FLOW[flight.status];

  flight.status = nextStatus;

  broadcast({ type: 'flight-updated', flight });
}, 5000);

setInterval(pushWeather, 7000);

const port = Number(process.env.PORT) || 3000;

server.listen(port, () => {
  console.log(`Табло авиарейсов: http://localhost:${port}`);
  pushWeather();
  pushWeather();
  pushWeather();
});
