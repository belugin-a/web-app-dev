import { applyFlightUpdate, replaceFlights } from './store.js';

const MAX_LOG_ITEMS = 8;

const statusElement = document.querySelector('#ws-status');
const statusText = document.querySelector('#ws-status-text');
const logElement = document.querySelector('#ws-log');
const pingButton = document.querySelector('#ws-ping');

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

export function requestSnapshot() {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'refresh' }));
  }
}

function connect() {
  setConnectionState('connecting', 'Подключение…');

  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  socket = new WebSocket(`${protocol}://${location.host}/ws`);

  socket.addEventListener('open', () => {
    setConnectionState('open', 'Подключено');
    addLog('Соединение установлено');
  });

  socket.addEventListener('message', (event) => {
    handleMessage(event.data);
  });

  socket.addEventListener('close', () => {
    setConnectionState('closed', 'Отключено');
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

  if (message.type === 'pong') {
    addLog('Получен pong — канал работает в обе стороны');
  }
}

function setConnectionState(modifier, text) {
  statusElement.classList.remove('connection--connecting', 'connection--open', 'connection--closed');
  statusElement.classList.add(`connection--${modifier}`);
  statusText.textContent = text;
}

function addLog(text) {
  logElement.querySelector('.log__empty')?.remove();

  const item = document.createElement('li');
  item.className = 'log__item';

  const time = document.createElement('span');
  time.className = 'log__time';
  time.textContent = new Date().toLocaleTimeString('ru-RU', { hour12: false });

  const message = document.createElement('span');
  message.textContent = text;

  item.append(time, message);
  logElement.append(item);

  while (logElement.children.length > MAX_LOG_ITEMS) {
    logElement.firstElementChild.remove();
  }

  logElement.scrollTop = logElement.scrollHeight;
}
