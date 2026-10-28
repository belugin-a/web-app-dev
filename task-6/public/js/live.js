import { applyFlightUpdate, replaceFlights } from './store.js';

const MAX_LOG_ITEMS = 10;
const MAX_FEED_ITEMS = 12;

const WEATHER_ICONS = [
  [/гроза/i, '⛈'],
  [/снег/i, '❄'],
  [/дожд/i, '🌧'],
  [/туман/i, '🌫'],
  [/облач/i, '☁'],
  [/ясно/i, '☀'],
];

const wsStatusElement = document.querySelector('#ws-status');
const wsStatusText = document.querySelector('#ws-status-text');
const wsLogElement = document.querySelector('#ws-log');

const sseStatusElement = document.querySelector('#sse-status');
const sseStatusText = document.querySelector('#sse-status-text');
const sseFeedElement = document.querySelector('#sse-feed');

let socket = null;

export function initLiveUpdates() {
  if (wsLogElement.children.length === 0) {
    wsLogElement.innerHTML = '<li class="log__empty">Ожидание обновлений…</li>';
  }

  connect();

  wsStatusElement.addEventListener('click', () => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'ping' }));
      return;
    }

    addLog('Нет соединения');
  });
}

export function initSseFeed() {
  if (sseFeedElement.children.length === 0) {
    sseFeedElement.innerHTML = '<li class="log__empty">Ожидание сводок…</li>';
  }

  const source = new EventSource('/events');

  source.addEventListener('open', () => {
    setConnectionState(sseStatusElement, sseStatusText, 'open', 'В сети');
  });

  source.addEventListener('error', () => {
    setConnectionState(sseStatusElement, sseStatusText, 'closed', 'Нет связи');
  });

  source.addEventListener('announcement', (event) => {
    let announcement;

    try {
      announcement = JSON.parse(event.data);
    } catch {
      return;
    }

    addFeedItem(announcement);
  });
}

export function requestSnapshot() {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'refresh' }));
  }
}

function connect() {
  setConnectionState(wsStatusElement, wsStatusText, 'connecting', 'Подключение…');

  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  socket = new WebSocket(`${protocol}://${location.host}/ws`);

  socket.addEventListener('open', () => {
    setConnectionState(wsStatusElement, wsStatusText, 'open', 'В сети');
  });

  socket.addEventListener('message', (event) => {
    handleMessage(event.data);
  });

  socket.addEventListener('close', () => {
    setConnectionState(wsStatusElement, wsStatusText, 'closed', 'Нет связи');
    setTimeout(connect, 3000);
  });
}

function handleMessage(rawMessage) {
  let message;

  try {
    message = JSON.parse(rawMessage);
  } catch {
    return;
  }

  if (message.type === 'snapshot') {
    replaceFlights(message.flights);
    return;
  }

  if (message.type === 'flight-updated') {
    applyFlightUpdate(message.flight);
    addLog(`${message.flight.number} → ${message.flight.status}`);
    return;
  }

  if (message.type === 'flight-added') {
    applyFlightUpdate(message.flight);
    addLog(`${message.flight.number} добавлен`);
    return;
  }

  if (message.type === 'pong') {
    addLog('Связь в порядке');
  }
}

function setConnectionState(element, textElement, modifier, text) {
  element.classList.remove('connection--connecting', 'connection--open', 'connection--closed');
  element.classList.add(`connection--${modifier}`);
  textElement.textContent = text;
}

function addLog(text) {
  appendListItem(wsLogElement, {
    text,
    time: new Date(),
    maxItems: MAX_LOG_ITEMS,
  });
}

function addFeedItem(announcement) {
  appendListItem(sseFeedElement, {
    text: announcement.text,
    time: announcement.at ? new Date(announcement.at) : new Date(),
    icon: weatherIcon(announcement.text),
    maxItems: MAX_FEED_ITEMS,
  });
}

function appendListItem(list, { text, time, icon, maxItems }) {
  list.querySelector('.log__empty')?.remove();

  const item = document.createElement('li');
  item.className = 'log__item';

  if (icon) {
    const iconElement = document.createElement('span');
    iconElement.className = 'log__icon';
    iconElement.textContent = icon;
    item.append(iconElement);
  }

  const timeElement = document.createElement('span');
  timeElement.className = 'log__time';
  timeElement.textContent = time.toLocaleTimeString('ru-RU', { hour12: false });

  const messageElement = document.createElement('span');
  messageElement.textContent = text;

  item.append(timeElement, messageElement);
  list.append(item);

  while (list.children.length > maxItems) {
    list.firstElementChild.remove();
  }

  list.scrollTop = list.scrollHeight;
}

function weatherIcon(text) {
  for (const [pattern, icon] of WEATHER_ICONS) {
    if (pattern.test(text)) {
      return icon;
    }
  }

  return '';
}
