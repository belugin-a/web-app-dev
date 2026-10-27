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

const port = Number(process.env.PORT) || 3000;

server.listen(port, () => {
  console.log(`Табло авиарейсов: http://localhost:${port}`);
});
