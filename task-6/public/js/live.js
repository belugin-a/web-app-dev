import { applyFlightUpdate, replaceFlights } from './store.js';

const MAX_LOG_ITEMS = 8;
const MAX_FEED_ITEMS = 12;

const wsStatusElement = document.querySelector('#ws-status');
const wsStatusText = document.querySelector('#ws-status-text');
const wsLogElement = document.querySelector('#ws-log');
const pingButton = document.querySelector('#ws-ping');

const sseStatusElement = document.querySelector('#sse-status');
const sseStatusText = document.querySelector('#sse-status-text');
const sseFeedElement = document.querySelector('#sse-feed');

let socket = null;

export function initLiveUpdates() {
  connect();

  pingButton.addEventListener('click', () => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'ping' }));
      addLog('Отправлен ping');
    } else {
      addLog('Соединение не установлено — ping не отправлен');
    }
  });
}

export function initSseFeed() {
  const source = new EventSource('/events');

  source.addEventListener('open', () => {
    setConnectionState(sseStatusElement, sseStatusText, 'open', 'Подключено');
  });

  source.addEventListener('error', () => {
    setConnectionState(sseStatusElement, sseStatusText, 'closed', 'Переподключение…');
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
    setConnectionState(wsStatusElement, wsStatusText, 'open', 'Подключено');
    addLog('Соединение установлено');
  });

  socket.addEventListener('message', (event) => {
    handleMessage(event.data);
  });

  socket.addEventListener('close', () => {
    setConnectionState(wsStatusElement, wsStatusText, 'closed', 'Отключено');
    addLog('Соединение закрыто, переподключение через 3 с');
    setTimeout(connect, 3000);
  });

  socket.addEventListener('error', () => {
    addLog('Ошибка WebSocket-соединения');
  });
}

function handleMessage(rawMessage) {
  let message;

  try {
    message = JSON.parse(rawMessage);
  } catch {
    addLog('Получено сообщение неизвестного формата');
    return;
  }

  if (message.type === 'snapshot') {
    replaceFlights(message.flights);
    addLog(`Снимок состояния: ${message.flights.length} рейсов`);
    return;
  }

  if (message.type === 'flight-updated') {
    applyFlightUpdate(message.flight);
    addLog(`Рейс ${message.flight.number}: ${message.flight.status}`);
    return;
  }

  if (message.type === 'flight-added') {
    applyFlightUpdate(message.flight);
    addLog(`Добавлен рейс ${message.flight.number} (${message.flight.city})`);
    return;
  }

  if (message.type === 'pong') {
    addLog('Получен pong — канал работает в обе стороны');
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
    modifier: announcement.level,
    maxItems: MAX_FEED_ITEMS,
  });
}

function appendListItem(list, { text, time, modifier = 'info', maxItems }) {
  list.querySelector('.log__empty')?.remove();

  const item = document.createElement('li');
  item.className = `log__item log__item--${modifier}`;

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
